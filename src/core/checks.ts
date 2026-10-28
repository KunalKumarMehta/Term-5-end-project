// Merge readiness (#6, #71, #72): one Verdict per required check, keyed `check › <name>`,
// worked out from the jobs whose check name (RQ-0) it is, on the head SHA.
import type { WorkflowJob } from "@actions/workflow-parser/model/workflow-template";
import { isBasicExpression } from "@actions/workflow-parser/templates/tokens/type-guards";
import type { Cause, Verdict } from "./index";
import { githubContext } from "./jobs";
import {
  RuntimeValueNeeded,
  checkName,
  evaluateTemplate,
  type JobSpans,
  type ParsedWorkflow,
} from "./parser";
import { settleable, type Scenario } from "./scenario";
import { PR_DEFAULT_TYPES } from "./triggers";
import type { Named } from "./names";

/** A job that reports a check on the head SHA, with its GitHub workflow's Verdict. */
export interface Producer extends Named {
  /** What its `name:` expression needs (WN-4). */
  needed?: string;
  job: Verdict;
  workflow: Verdict;
  /** The job's positions, for the causes that point at it. */
  spans?: JobSpans;
}

// From most to least blocking (#6).
const RANK = [
  "fails and blocks merge",
  "pending and blocks merge",
  "uncertain",
  "may not block",
  "passes",
];

const cause = (rule: string, inputs: Cause["inputs"] = []): Cause => ({
  rule,
  spans: [],
  inputs,
});

/**
 * A job's check name (RQ-0), its `name:` expression evaluated against the Scenario (#8 §5):
 * a value the Scenario lacks, or one that exists only at run time, leaves it unknown (WN-4).
 */
export function nameOf(
  job: WorkflowJob,
  scenario: Scenario,
): Pick<Producer, "name" | "needed"> {
  if (!job.name || !isBasicExpression(job.name))
    return { name: checkName(job) };
  const vars = scenario.repo.vars ?? {};
  try {
    const name = evaluateTemplate(
      `\${{ ${job.name.expression} }}`,
      {
        github: githubContext(scenario),
        vars: {},
        needs: {},
        strategy: {},
        matrix: {},
        inputs: {},
      },
      ([context, field]) => {
        // shortcut: github.* reads the worked-out context as given, so an unknown
        // github.event field reads empty; resolve it as jobs.ts does if a name ever needs one.
        if (context!.toLowerCase() === "github") return undefined;
        if (context!.toLowerCase() === "vars" && field !== undefined) {
          const found = Object.keys(vars).find(
            (k) => k.toLowerCase() === field.toLowerCase(),
          );
          return found === undefined
            ? { needed: `vars.${field}` }
            : { value: vars[found] };
        }
        // needs, strategy, matrix and inputs exist only at run time.
        return { needed: [context, field].filter(Boolean).join(".") };
      },
    );
    return { name };
  } catch (e) {
    if (!(e instanceof RuntimeValueNeeded)) throw e;
    return { name: undefined, needed: e.needed };
  }
}

/**
 * The jobs of a file with a Diagnostic still name checks, but WhyNoRun can't work them out:
 * each stands behind an Uncertain badge, root RQ-0 at the job and the first Diagnostic (#6).
 */
export function unreadable(
  key: string,
  file: ParsedWorkflow,
  scenario: Scenario,
): Producer[] {
  const { path, line, col, endLine, endCol } = file.diagnostics[0]!;
  return file.jobs.map((job) => {
    const spans = file.jobSpans.get(job.id.value);
    const unread: Verdict = {
      key: `${key} › ${job.id.value}`,
      value: "uncertain",
      causes: [
        {
          rule: "RQ-0",
          spans: [
            ...(spans ? [spans.id] : []),
            { path, line, col, endLine, endCol },
          ],
          inputs: [],
        },
      ],
      settle: [],
    };
    return {
      id: job.id.value,
      ...nameOf(job, scenario),
      job: unread,
      workflow: unread,
      spans,
    };
  });
}

export function checkVerdicts(
  producers: Producer[],
  { event, repo }: Scenario,
  /** With the merge queue on, the producers of the `merge_group` stage (#73). */
  queued?: Producer[],
): Verdict[] {
  // Names from a Test file are kept exactly, so one may repeat; a key exists once.
  const names = [...new Set(repo.required)];
  // Only an activity that creates a head SHA gets checks (#6).
  if (
    event.name !== "push" &&
    event.type !== undefined &&
    !PR_DEFAULT_TYPES.includes(event.type)
  )
    return names.map((name) => ({
      key: `check › ${name}`,
      value: "unsupported",
      causes: [cause("WN-3", [{ path: "event.type", value: event.type }])],
    }));
  // RQ-10 is an Explanation note, never a badge (#6).
  const notes = repo.strict
    ? [cause("RQ-10", [{ path: "repo.strict", value: true }])]
    : [];
  // RQ-6: a merge group no GitHub workflow runs for reports nothing.
  const unqueued = cause("RQ-6", [{ path: "repo.mergeQueue", value: true }]);
  return names.map((name) => {
    const pr = named(name, producers, cause("RQ-1"));
    const queue = queued && named(name, queued, unqueued);
    // The badge is the more blocking of the PR and merge-queue stages (#6).
    const { causes, ...rest } =
      queue && RANK.indexOf(queue.value) < RANK.indexOf(pr.value) ? queue : pr;
    return { key: `check › ${name}`, ...rest, causes: [...causes, ...notes] };
  });
}

/** A name derived from a matrix job (`<name> (…)`) or a remote caller (`<caller> / …`), RQ-9. */
const prefixed = (p: Producer, name: string) =>
  p.name !== undefined &&
  (p.via === "remote"
    ? name.startsWith(`${p.name} / `)
    : p.via === "matrix" && name.startsWith(`${p.name} (`));

/** The producer a required name matches: an exact name first, then an RQ-9 prefix. */
function match(producers: Producer[], name: string): Producer | undefined {
  return (
    producers.find((p) => p.name === name && p.via !== "remote") ??
    producers.find((p) => prefixed(p, name))
  );
}

/** The badge with how the name was derived (RQ-9, #8 §10) applied. */
function named(
  name: string,
  producers: Producer[],
  skipped: Cause,
): Omit<Verdict, "key"> {
  const computed = badge(name, producers, skipped);
  const producer = match(producers, name);
  // A remote callee's checks are never seen: when its caller runs, what it reports is unknown.
  if (producer?.via === "remote" && producer.job.value === "runs")
    return {
      value: "uncertain",
      causes: [
        { rule: "WN-6", spans: [producer.uses!], inputs: [] },
        ...producer.job.causes,
      ],
      settle: [],
    };
  // `<caller> / <callee>` is documented (RQ-9 revised), so the badge stands.
  if (producer?.via === "callee")
    return {
      ...computed,
      causes: [computed.causes[0]!, cause("RQ-9"), ...computed.causes.slice(1)],
    };
  // A matrix job's check names are undocumented (RQ-9): its badge, or never reported.
  if (producer?.via === "matrix")
    return {
      value: "uncertain",
      causes: [
        cause("RQ-9", [{ path: "repo.required", value: name }]),
        ...computed.causes,
      ],
      possible: [
        ...new Set([
          ...(computed.possible ?? [computed.value]),
          "pending and blocks merge",
        ]),
      ].sort(),
      settle: [],
    };
  return computed;
}

function badge(
  name: string,
  producers: Producer[],
  skipped: Cause,
): Omit<Verdict, "key"> {
  // Nothing reports the check, which GitHub's guidance (RQ-8) answers.
  const pending = (...causes: Cause[]) => ({
    value: "pending and blocks merge",
    causes: [...causes, cause("RQ-8")],
  });
  const typed = { path: "repo.required", value: name };
  const exact = producers.filter((p) => p.name === name && p.via !== "remote");
  // Whether matching ignores case is undocumented (RQ-0), so a case-only match is Uncertain.
  const cased = producers.filter(
    (p) => p.via !== "remote" && p.name?.toLowerCase() === name.toLowerCase(),
  );
  const matched =
    exact.length > 0
      ? exact
      : cased.length > 0
        ? cased
        : producers.filter((p) => prefixed(p, name));
  // One job may report on more than one Event: the PR's and its implied push.
  const jobs = new Map<string, Producer[]>();
  for (const p of matched)
    jobs.set(p.job.key, [...(jobs.get(p.job.key) ?? []), p]);
  if (jobs.size === 0) {
    const unknown = producers.find((p) => p.needed !== undefined);
    if (!unknown) return pending(cause("RQ-0", [typed]));
    // A `name:` the Scenario can't evaluate may be this check (#8 §5).
    return {
      value: "uncertain",
      causes: [
        {
          rule: "WN-4",
          spans: unknown.spans?.name ? [unknown.spans.name] : [],
          inputs: [],
        },
        cause("RQ-0", [typed]),
      ],
      settle: settleable(unknown.needed!) ? [unknown.needed!] : [],
    };
  }
  const badges = [...jobs.values()].map((stages) => {
    const all = stages.map((p) => stage(p, pending, skipped));
    // A stage whose GitHub workflow is filtered out reports nothing; the others all count.
    const reported = all.filter((b) => b.causes[0]?.rule !== skipped.rule);
    return (reported.length > 0 ? reported : all).reduce((a, b) =>
      RANK.indexOf(b.value) < RANK.indexOf(a.value) ? b : a,
    );
  });
  const ids = (ps: Producer[]) =>
    ps.flatMap((p) => (p.spans ? [p.spans.id] : []));
  const values = [...new Set(badges.map((b) => b.value))].sort();
  // Duplicate names give "ambiguous status check results" (RQ-0).
  if (badges.length > 1)
    return {
      value: "uncertain",
      causes: [
        {
          rule: "RQ-0",
          spans: [...jobs.values()].flatMap((ps) => ids(ps.slice(0, 1))),
          inputs: [typed],
        },
      ],
      ...(values.length <= 3 && { possible: values }),
      settle: [],
    };
  const result = badges[0]!;
  // An exact or RQ-9 prefix match: `named` applies the prefix's rule.
  if (exact.length > 0 || cased.length === 0) return result;
  return {
    value: "uncertain",
    causes: [
      { rule: "RQ-0", spans: ids(matched.slice(0, 1)), inputs: [typed] },
      ...result.causes,
    ],
    possible: [
      ...new Set([
        ...(result.possible ?? [result.value]),
        "pending and blocks merge",
      ]),
    ].sort(),
    settle: [],
  };
}

/** The badge one producer gives the check, from its job's and GitHub workflow's Verdicts. */
function stage(
  { job, workflow, spans }: Producer,
  pending: (...causes: Cause[]) => Omit<Verdict, "key">,
  skipped: Cause,
): Omit<Verdict, "key"> {
  if (job.value === "runs")
    return { value: "passes", causes: [cause("RQ-4"), ...job.causes] };
  if (job.value === "fails") {
    const causes = [cause("RQ-4"), ...job.causes];
    // JG-11: GitHub's docs don't say what conclusion a continue-on-error job's check gets.
    if (spans?.continueOnError)
      return {
        value: "uncertain",
        causes: [
          { rule: "JG-11", spans: [spans.continueOnError], inputs: [] },
          ...causes,
        ],
        possible: ["fails and blocks merge", "passes"],
        settle: [],
      };
    return { value: "fails and blocks merge", causes };
  }
  // Skipped by its own `if:`, or through a `needs` chain rooted in one, it reports success;
  // through a chain with a failure in it, it may not block (RQ-3).
  if (job.value === "skipped")
    return job.causes[0]?.rule === "JG-3"
      ? { value: "passes", causes: [cause("RQ-2"), ...job.causes] }
      : { value: "may not block", causes: [cause("RQ-3"), ...job.causes] };
  if (job.value === "no-run") {
    // A filter or commit-message skip (RQ-1), or no merge_group run (RQ-6), creates no check run.
    if (workflow.value === "skipped") return pending(skipped, ...job.causes);
    // A run awaiting approval starts no job, so nothing reports (#8 §2).
    if (workflow.value === "pending") return pending(...job.causes);
    // The failed run's check conclusion is undocumented (PRT-5), but it blocks either way (#8 §4).
    if (workflow.value === "fails")
      return {
        value: "fails and blocks merge",
        causes: [cause("RQ-4"), ...job.causes],
      };
  }
  // An upstream Verdict is Uncertain, and its chain stands behind the badge.
  return {
    value: "uncertain",
    causes: job.causes,
    settle: job.settle ?? [],
    ...(job.hints && { hints: job.hints }),
  };
}
