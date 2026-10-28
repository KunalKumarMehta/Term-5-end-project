// Merge readiness (#6, #71): one Verdict per required check, keyed `check › <name>`, worked out
// from the jobs whose check name (RQ-0) it is, on the head SHA.
import type { Cause, Verdict } from "./index";
import type { Scenario } from "./scenario";
import { PR_DEFAULT_TYPES } from "./triggers";
import type { Named } from "./names";

/** A job that reports a check on the head SHA, with its GitHub workflow's Verdict. */
export interface Producer extends Named {
  job: Verdict;
  workflow: Verdict;
}

const cause = (rule: string, inputs: Cause["inputs"] = []): Cause => ({
  rule,
  spans: [],
  inputs,
});

// #6: from most to least blocking.
const BLOCKING = [
  "fails and blocks merge",
  "pending and blocks merge",
  "uncertain",
  "may not block",
  "passes",
];

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
    const pr = named(name, producers, notes, cause("RQ-1"));
    const queue = queued && named(name, queued, notes, unqueued);
    // The badge is the more blocking of the PR and merge-queue stages (#6).
    return {
      key: `check › ${name}`,
      ...(queue && BLOCKING.indexOf(queue.value) < BLOCKING.indexOf(pr.value)
        ? queue
        : pr),
    };
  });
}

/**
 * The producer a required name matches: an exact name first, then a name derived from a
 * matrix job (`<name> (…)`) or a remote caller (`<caller> / …`), both RQ-9 prefixes.
 */
function match(producers: Producer[], name: string): Producer | undefined {
  const known = producers.filter((p) => p.name !== undefined);
  return (
    known.find((p) => p.name === name && p.via !== "remote") ??
    known.find((p) =>
      p.via === "remote"
        ? name.startsWith(`${p.name} / `)
        : p.via === "matrix" && name.startsWith(`${p.name} (`),
    )
  );
}

/** The badge with how the name was derived (RQ-9, #8 §10) applied. */
function named(
  name: string,
  producers: Producer[],
  notes: Cause[],
  skipped: Cause,
): Omit<Verdict, "key"> {
  const computed = badge(name, producers, notes, skipped);
  const producer = match(producers, name);
  // A remote callee's checks are never seen: when its caller runs, what it reports is unknown.
  if (producer?.via === "remote" && producer.job.value === "runs")
    return {
      value: "uncertain",
      causes: [
        { rule: "WN-6", spans: [producer.uses!], inputs: [] },
        ...producer.job.causes,
        ...notes,
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
        ...new Set([computed.value, "pending and blocks merge"]),
      ].sort(),
      settle: [],
    };
  return computed;
}

function badge(
  name: string,
  producers: Producer[],
  notes: Cause[],
  skipped: Cause,
): Omit<Verdict, "key"> {
  // Nothing reports the check, which GitHub's guidance (RQ-8) answers.
  const pending = (...causes: Cause[]) => ({
    value: "pending and blocks merge",
    causes: [...causes, cause("RQ-8"), ...notes],
  });
  // shortcut: exact names and the first producer only; #72 adds case-only matches, `name:`
  // expressions (WN-4) and duplicate producers, all Uncertain.
  const producer = match(producers, name);
  if (!producer)
    return pending(cause("RQ-0", [{ path: "repo.required", value: name }]));
  const { job, workflow } = producer;
  if (job.value === "runs")
    return {
      value: "passes",
      causes: [cause("RQ-4"), ...job.causes, ...notes],
    };
  // Skipped by its own `if:`, or through a `needs` chain rooted in one: it reports success.
  if (job.value === "skipped" && job.causes[0]?.rule === "JG-3")
    return {
      value: "passes",
      causes: [cause("RQ-2"), ...job.causes, ...notes],
    };
  // A filter or commit-message skip (RQ-1), or no merge_group run (RQ-6), creates no check run.
  if (job.value === "no-run" && workflow.value === "skipped")
    return pending(skipped, ...job.causes);
  // shortcut: May not block, Fails and blocks merge and the Uncertain badge's own rules arrive
  // with #72; until then the producer's chain stands behind an Uncertain badge.
  return {
    value: "uncertain",
    causes: [...job.causes, ...notes],
    settle: job.settle ?? [],
    ...(job.hints && { hints: job.hints }),
  };
}
