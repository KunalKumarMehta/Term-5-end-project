// Job Verdicts: `if:` with its implicit `success() &&`, `needs` propagation, the "job X fails"
// Assumption, values that exist only at run time (JG-1..3, JG-11, WN-1, WN-2, WN-4), and
// checkout's refusal of a fork's head under pull_request_target (CO-1, CO-3, CO-5, CO-6).
import type { Cause, Verdict } from "./index";
import {
  RuntimeValueNeeded,
  evaluateCondition,
  evaluateTemplate,
  type Checkout,
  type JobSpans,
  type ParsedWorkflow,
  type Resolve,
  type Span,
} from "./parser";
import type { Scenario } from "./scenario";

type Conclusion = "success" | "failure" | "skipped";

/** A cause, or the place where a need's final causes go. */
type Part = Cause | { from: string };

interface Outcome {
  value: string;
  parts: Part[];
  /** What `needs.<id>.result` reads. */
  conclusion: Conclusion;
  /** Whether this job or an ancestor failed, which is what a dependent's failure() reads. */
  failed: boolean;
  /** The unsettled values it read, its needs' first in `needs` order, then its own `if:`'s. */
  reads: string[];
}

/** A value the Scenario lacks (WN-4), or a JG-11 job's reading, that the branches range over. */
interface Unsettled {
  rule: "WN-4" | "JG-11" | "CO-3";
  span: Span | undefined;
  /** The job whose evaluation first needed it. */
  job: string;
  /** Whether a Scenario input settles it; a value that exists only at run time doesn't. */
  settle: boolean;
  /** The literals the expression compares it with. */
  compared: unknown[];
  /** The values its branches take. */
  candidates: unknown[];
  /** The `settle` path, when it isn't the name the branches know it by. */
  path?: string;
  /** Causes that follow its own on an Uncertain Verdict. */
  after?: Cause[];
}

// A value no expression compares with, standing in for "any other value".
const OTHER = "\u0000other";

const cause = (
  rule: string,
  span: Span | undefined,
  inputs: Cause["inputs"] = [],
): Cause => ({ rule, spans: span ? [span] : [], inputs });

// The github.* fields worked out from the Event (#8 §6); any other is a run-time value.
const FROM_EVENT = new Set([
  "event_name",
  "ref",
  "ref_name",
  "head_ref",
  "base_ref",
  "sha",
  "run_id",
]);
// A payload object the event never has resolves to empty, as on GitHub.
// shortcut: only the objects the other supported event has; list each event's payload
// keys when an event without either arrives.
const ABSENT: Record<string, string[]> = {
  push: ["pull_request"],
  pull_request: ["head_commit"],
  pull_request_target: ["head_commit"],
};
// Contexts a step's input can read that exist only at run time.
const RUN_TIME = new Set([
  "steps",
  "env",
  "matrix",
  "runner",
  "job",
  "secrets",
  "strategy",
]);
const PR_REF = /^refs\/pull\/[0-9]+\/(?:head|merge)$/;

/**
 * Whether a checkout version has the refusal (CO-3): every floating major from v2 and every
 * v7 release do, v1 doesn't, and an earlier SHA, minor or patch pin may not (undefined).
 */
function covered(version: string): boolean | undefined {
  const m = /^v(\d+)(\.\d+){0,2}$/.exec(version);
  if (!m) return undefined;
  const major = Number(m[1]);
  if (major < 2) return false;
  return m[2] === undefined || major >= 7 ? true : undefined;
}

/** One Verdict per job of a loaded GitHub workflow, keyed `<file> › <jobId>`. */
export function jobVerdicts(
  file: string,
  parsed: ParsedWorkflow,
  workflow: Verdict,
  scenario: Scenario,
): Verdict[] {
  const key = (id: string) => `${file} › ${id}`;
  const ids = parsed.jobs.map((j) => j.id.value);
  // An uncertain GitHub workflow leaves its jobs uncertain, settled by the same inputs.
  if (workflow.value === "uncertain")
    return ids.map((id) => ({
      key: key(id),
      value: "uncertain",
      causes: workflow.causes,
      settle: workflow.settle,
    }));
  if (workflow.value !== "runs")
    return ids.map((id) => ({
      key: key(id),
      value: "no-run",
      causes: workflow.causes,
    }));

  const jobs = new Map(parsed.jobs.map((j) => [j.id.value, j]));
  const spans = (id: string): Partial<JobSpans> =>
    parsed.jobSpans.get(id) ?? {};
  const assume = scenario.assume ?? {};
  const fails = (id: string) =>
    Object.hasOwn(assume, key(id)) && assume[key(id)] === "fails";
  const github = githubContext(scenario);
  const contexts = { github, vars: { ...scenario.repo.vars }, inputs: {} };
  const { event, repo } = scenario;
  const unsettled = new Map<string, Unsettled>();

  /** A declared output: its literal value, or the expression a step fills it from. */
  const outputOf = (
    id: string,
    name: string,
  ): { value: string } | { name: string; expression: string } | undefined => {
    const outputs = jobs.get(id)?.outputs;
    for (let i = 0; i < (outputs?.count ?? 0); i++) {
      const { key: k, value } = outputs!.get(i);
      const declared = k.toString();
      if (declared.toLowerCase() !== name.toLowerCase()) continue;
      const expression = (value as { expression?: string }).expression;
      return expression === undefined
        ? { value: value.toString() }
        : { name: declared, expression };
    }
    return undefined;
  };

  /** Reads one job's `if:` contexts for a branch, recording which unsettled values it read. */
  const resolver =
    (
      id: string,
      needs: [string, Outcome][],
      assigned: Map<string, unknown>,
      reads: string[],
    ): Resolve =>
    (path, compared) => {
      const lack = (name: string) => {
        if (!assigned.has(name)) return { needed: name };
        note(name, compared(), id);
        reads.push(name);
        return { value: assigned.get(name) };
      };
      const [context, ...rest] = path.map((s, i) => (i ? s : s.toLowerCase()));
      if (context === "vars" && rest.length > 0) {
        const vars = scenario.repo.vars ?? {};
        const found = ownKey(vars, rest[0]!);
        if (found === undefined) return lack(`vars.${rest[0]}`);
        return { value: rest.length === 1 ? vars[found] : null };
      }
      if (
        context === "needs" &&
        rest.length === 3 &&
        rest[1]!.toLowerCase() === "outputs"
      ) {
        const need = needs.find(
          ([id]) => id.toLowerCase() === rest[0]!.toLowerCase(),
        );
        // A job that didn't succeed sets no outputs, and an undeclared one is empty.
        if (need?.[1].conclusion !== "success") return undefined;
        const output = outputOf(need[0], rest[2]!);
        if (!output || "value" in output) return output;
        const name = `${key(need[0])} › outputs.${output.name}`;
        return Object.hasOwn(assume, name)
          ? { value: assume[name] }
          : lack(name);
      }
      if (context !== "github" || rest.length === 0) return undefined;
      const field = rest[0]!.toLowerCase();
      if (field === "repository" || field === "repository_owner") {
        const got =
          repo.repository === undefined
            ? lack("repo.repository")
            : { value: repo.repository };
        if (!("value" in got) || field === "repository") return got;
        return { value: String(got.value).split("/")[0] };
      }
      if (field === "actor" || field === "triggering_actor")
        return event.actor === "dependabot"
          ? { value: "dependabot[bot]" }
          : event.login === undefined
            ? lack("event.login")
            : { value: event.login };
      if (FROM_EVENT.has(field)) return undefined;
      if (field !== "event") return lack(`github.${rest[0]}`);
      if (rest.length === 1) return undefined;

      // github.event.*: the Event's fields and its payload, read with Object.hasOwn.
      const star = rest.indexOf("*");
      const walk = rest.slice(1, star < 0 ? undefined : star);
      let at: unknown = github.event;
      for (const seg of walk) {
        if (!isObj(at)) return { value: null };
        const found = ownKey(at, seg);
        if (found === undefined) {
          if (ABSENT[event.name]?.includes(walk[0]!.toLowerCase()))
            return { value: null };
          // A member's own repo is the base repo, so its full_name is the owner/repo fact.
          if (
            walk.join(".").toLowerCase() === "pull_request.head.repo.full_name"
          )
            return lack("repo.repository");
          return lack(`github.event.${rest.slice(1).join(".")}`);
        }
        at = at[found];
      }
      return star < 0 ? { value: at } : undefined;
    };

  const candidatesOf = (name: string, compared: unknown[]): unknown[] => {
    if (name.includes(".*.")) return [...compared.map((c) => [c]), [], [OTHER]];
    const nonEmpty = name === "repo.repository" || name === "event.login";
    return [
      ...new Set([
        ...compared,
        // Either side of a number an expression compares with.
        ...compared.flatMap((c) =>
          typeof c === "number" ? [c - 1, c + 1] : [],
        ),
        ...(nonEmpty ? [] : [""]),
        OTHER,
      ]),
    ];
  };
  // Set when a value turns out to be compared with a literal its branches missed.
  let grown: boolean;
  /** Notes a value the Scenario lacks, and every literal any expression compares it with. */
  const note = (name: string, compared: unknown[], id: string) => {
    const known = unsettled.get(name);
    if (!known) {
      unsettled.set(name, {
        rule: "WN-4",
        span: spans(id).if ?? spans(id).id,
        job: id,
        // Other github.* fields exist only at run time.
        settle: !name.startsWith("github.") || name.startsWith("github.event."),
        compared,
        candidates: candidatesOf(name, compared),
      });
      return;
    }
    const fresh = compared.filter((c) => !known.compared.includes(c));
    if (known.rule !== "WN-4" || fresh.length === 0) return;
    known.compared = [...known.compared, ...fresh];
    known.candidates = candidatesOf(name, known.compared);
    grown = true;
  };

  /** Branches on a value the Scenario can't give, the way an `if:` read branches on one. */
  const ask = (name: string, u: Unsettled, assigned: Map<string, unknown>) => {
    if (!assigned.has(name)) {
      unsettled.set(name, u);
      throw new RuntimeValueNeeded(name);
    }
    return assigned.get(name) === true;
  };

  /**
   * CO-1: checkout refuses a fork's head under pull_request_target; the job fails at the first
   * refused step without step-level `continue-on-error: true` (CO-6). A default checkout (no
   * `ref` or `repository`) skips the check, and so does the opt-out.
   * shortcut: a step's own `if:` is not read; a skipped refused checkout counts as run.
   */
  const refused = (
    id: string,
    needs: [string, Outcome][],
    assigned: Map<string, unknown>,
    reads: string[],
  ): { fails: boolean; parts: Cause[] } | undefined => {
    if (event.name !== "pull_request_target" || event.actor !== "fork")
      return undefined;
    const found: Cause[] = [];
    for (const [i, step] of spans(id).checkouts?.entries() ?? []) {
      if (step.optOut || (!step.ref && !step.repository)) continue;
      const target = headOf(id, i, step, needs, assigned, reads);
      if (!target) continue;
      const version = covered(step.version);
      if (version === false) continue;
      const pinned: Cause[] = [];
      if (version === undefined) {
        const name = `CO-3 ${id} ${i}`;
        const yes = ask(
          name,
          {
            rule: "CO-3",
            span: step.uses,
            job: id,
            settle: false,
            compared: [],
            candidates: [false, true],
            after: [cause("CO-1", step.uses)],
          },
          assigned,
        );
        reads.push(name);
        if (!yes) continue;
        pinned.push(cause("CO-3", step.uses));
      }
      const co1: Cause = {
        rule: "CO-1",
        spans: [step.uses, target],
        inputs: [{ path: "event.actor", value: event.actor }],
      };
      if (!step.continueOnError)
        return { fails: true, parts: [co1, ...pinned, ...found] };
      found.push(cause("CO-6", step.continueOnError), co1, ...pinned);
    }
    return found.length > 0 ? { fails: false, parts: found } : undefined;
  };

  /**
   * The input that points a checkout at the fork's head, if one does: `repository` is the
   * head repo, or `ref` is a pull ref or the head or merge commit (#8 §6 placeholders).
   * An input reading a value the Scenario lacks branches on whether it does (CO-5).
   */
  const headOf = (
    id: string,
    i: number,
    step: Checkout,
    needs: [string, Outcome][],
    assigned: Map<string, unknown>,
    reads: string[],
  ): Span | undefined => {
    const base = resolver(id, needs, assigned, reads);
    const context = {
      ...contexts,
      needs: Object.fromEntries(
        needs.map(([n, o]) => [n, { result: o.conclusion, outputs: {} }]),
      ),
      ...Object.fromEntries([...RUN_TIME].map((c) => [c, {}])),
    };
    const pr = github.event.pull_request as {
      head: { sha: string; repo: { full_name?: string } };
      merge_commit_sha: string;
    };
    const heads = [pr.head.sha, pr.merge_commit_sha];
    const value = (input: { text: string; span: Span }) => {
      try {
        return evaluateTemplate(input.text, context, (path, compared) =>
          RUN_TIME.has(path[0]!.toLowerCase())
            ? { needed: path.join(".") }
            : base(path, compared),
        );
      } catch (e) {
        if (!(e instanceof RuntimeValueNeeded)) throw e;
        const name = `CO-5 ${id} ${i}`;
        const context = e.needed.split(".")[0]!;
        const yes = ask(
          name,
          {
            rule: "WN-4",
            span: input.span,
            job: id,
            settle:
              !RUN_TIME.has(context) &&
              (context !== "github" || e.needed.startsWith("github.event.")),
            compared: [],
            candidates: [false, true],
            path: e.needed,
            after: [cause("CO-5", input.span), cause("CO-1", step.uses)],
          },
          assigned,
        );
        reads.push(name);
        return yes ? undefined : null;
      }
    };
    for (const [input, matches] of [
      [
        step.repository,
        (v: string) =>
          v.toLowerCase() === pr.head.repo.full_name?.toLowerCase(),
      ],
      [step.ref, (v: string) => PR_REF.test(v) || heads.includes(v)],
    ] as const) {
      if (!input) continue;
      const v = value(input);
      // undefined: a branch where the unknown value is the fork's head.
      if (v === undefined || (v !== null && matches(v))) return input.span;
    }
    return undefined;
  };

  const evaluate = (assigned: Map<string, unknown>) => {
    const memo = new Map<string, Outcome>();
    const outcome = (id: string): Outcome => {
      const known = memo.get(id);
      if (known) return known;
      const job = jobs.get(id)!;
      const at = spans(id);
      const needs = (job.needs ?? []).map((n): [string, Outcome] => [
        n.value,
        outcome(n.value),
      ]);
      const results = (all?: Conclusion) =>
        Object.fromEntries(
          needs.map(([n, o]) => [
            n,
            { result: all ?? o.conclusion, outputs: {} },
          ]),
        );
      const failed = needs.some(([, o]) => o.failed);
      const blocker = needs.find(([, o]) => o.conclusion !== "success")?.[0];
      const reads: string[] = [];
      let runs: boolean;
      try {
        runs = evaluateCondition(
          job.if.expression,
          { ...contexts, needs: results() },
          { success: !blocker, failure: failed },
          resolver(id, needs, assigned, reads),
        );
      } catch (e) {
        if (e instanceof RuntimeValueNeeded) note(e.needed, e.compared, id);
        throw e;
      }
      let result: Omit<Outcome, "reads">;
      if (runs && fails(id)) {
        // JG-11: GitHub's docs don't say how a dependent sees a failing job with job-level
        // `continue-on-error: true`, so the branches read it both as failed and as succeeded.
        let succeeds = false;
        if (at.continueOnError) {
          const name = `JG-11 ${id}`;
          if (!assigned.has(name)) {
            unsettled.set(name, {
              rule: "JG-11",
              span: at.continueOnError,
              job: id,
              settle: false,
              compared: [],
              candidates: [false, true],
            });
            throw new RuntimeValueNeeded(name);
          }
          reads.push(name);
          succeeds = assigned.get(name) === true;
        }
        result = {
          value: "fails",
          parts: [cause("WN-1", at.id, [{ path: key(id), value: "fails" }])],
          conclusion: succeeds ? "success" : "failure",
          failed: failed || !succeeds,
        };
      } else if (runs) {
        const refusal = refused(id, needs, assigned, reads);
        result = refusal?.fails
          ? {
              value: "fails",
              parts: refusal.parts,
              conclusion: "failure",
              failed: true,
            }
          : {
              value: "runs",
              parts: [
                // A dependent that runs past a failed or skipped need does so by its status function.
                ...(blocker
                  ? [cause("JG-1", at.if ?? at.id), { from: blocker }]
                  : []),
                ...(refusal?.parts ?? []),
                cause("WN-2", at.id),
              ],
              conclusion: "success",
              failed,
            };
      } else {
        // Skipped by `needs` when the same `if:` would pass were every need a success; one
        // that would read a value the Scenario lacks is put down to the needs.
        let byNeeds = false;
        if (blocker)
          try {
            byNeeds = evaluateCondition(
              job.if.expression,
              { ...contexts, needs: results("success") },
              { success: true, failure: false },
              resolver(id, needs, assigned, []),
            );
          } catch (e) {
            if (!(e instanceof RuntimeValueNeeded)) throw e;
            byNeeds = true;
          }
        const implicit =
          at.if && job.if.expression.startsWith("success() && (");
        result = {
          value: "skipped",
          parts: byNeeds
            ? [
                { from: blocker! },
                cause("JG-1", at.needs ?? at.id),
                ...(implicit ? [cause("JG-2", at.if)] : []),
              ]
            : [cause("JG-3", at.if ?? at.id)],
          conclusion: "skipped",
          failed,
        };
      }
      const all = [...needs.flatMap(([, o]) => o.reads), ...reads];
      const done = { ...result, reads: [...new Set(all)] };
      memo.set(id, done);
      return done;
    };
    return new Map(ids.map((id) => [id, outcome(id)]));
  };

  // Every combination of the unsettled values' candidates, found as the evaluation needs them.
  // shortcut: each branch re-evaluates every job, 3^n for n unsettled values; fine for the
  // few a GitHub workflow reads, memoise per job if a real Workflow set is slow.
  let branches: Map<string, Outcome>[] = [];
  const explore = (assigned: Map<string, unknown>) => {
    try {
      branches.push(evaluate(assigned));
    } catch (e) {
      if (!(e instanceof RuntimeValueNeeded)) throw e;
      for (const value of unsettled.get(e.needed)!.candidates)
        explore(new Map(assigned).set(e.needed, value));
    }
  };
  // Again while a later read found a literal earlier branches missed; literals are finite.
  do {
    grown = false;
    branches = [];
    explore(new Map());
  } while (grown);

  const finals = new Map<string, Verdict>();
  const final = (id: string): Verdict => {
    const done = finals.get(id);
    if (done) return done;
    const results = branches.map((b) => b.get(id)!);
    const values = [...new Set(results.map((r) => r.value))];
    let verdict: Verdict;
    if (values.length === 1) {
      // Decided: its own root, keeping an upstream Verdict's causes where a branch links one.
      const linked = (r: Outcome) => r.parts.some((p) => "from" in p);
      const chosen = linked(results[0]!)
        ? results[0]!
        : (results.find(linked) ?? results[0]!);
      verdict = {
        key: key(id),
        value: values[0]!,
        causes: chosen.parts.flatMap((p) =>
          "from" in p ? final(p.from).causes : [p],
        ),
      };
    } else {
      // Uncertain: rooted in the first unsettled value, in `needs` order, then its own `if:`.
      const reads = [...new Set(results.flatMap((r) => r.reads))].map(
        (name) => [name, unsettled.get(name)!] as const,
      );
      const causes = reads.flatMap(([, u]) => [
        cause(u.rule, u.span),
        ...(u.after ?? []),
      ]);
      if (reads[0]![1].job !== id && spans(id).needs)
        causes.push(cause("JG-1", spans(id).needs));
      const settle = reads.filter(([, u]) => u.settle);
      verdict = {
        key: key(id),
        value: "uncertain",
        causes,
        ...(values.length <= 3 && { possible: values.sort() }),
        settle: settle.map(([name, u]) => u.path ?? name),
        ...(settle.length > 0 && {
          hints: settle.map(([name, u]) => ({
            path: u.path ?? name,
            text: hint(u.path ?? name),
            candidates: u.compared,
          })),
        }),
      };
    }
    finals.set(id, verdict);
    return verdict;
  };

  /** Where a settle path's value comes from, naming the action a job output comes from. */
  const hint = (path: string): string => {
    const output = /^.+ › (.+) › outputs\.(.+)$/.exec(path);
    if (output) {
      const [, id, name] = output;
      const step = /\bsteps\.([\w-]+)\.outputs\b/i.exec(
        (outputOf(id!, name!) as { expression?: string }).expression ?? "",
      )?.[1];
      const job = jobs.get(id!);
      const uses =
        step && job?.type === "job"
          ? job.steps.find((s) => s.id === step && "uses" in s)
          : undefined;
      const action =
        uses && "uses" in uses ? uses.uses.value.replace(/@.*$/, "") : "";
      return action
        ? `output \`${name}\` of \`${action}\` in job \`${id}\``
        : `output \`${name}\` of job \`${id}\``;
    }
    if (path.startsWith("vars."))
      return `repository variable \`${path.slice(5)}\``;
    if (path === "repo.repository")
      return "the `owner/repo` Repo fact, which `github.repository` reads";
    if (path === "event.login")
      return "the actor login on the Event, which `github.actor` reads";
    return `\`${path}\` on the Event`;
  };

  return ids.map(final);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** An own key of `obj` matching `name` as GitHub does, ignoring case. */
function ownKey(obj: object, name: string): string | undefined {
  if (Object.hasOwn(obj, name)) return name;
  const lower = name.toLowerCase();
  return Object.keys(obj).find((k) => k.toLowerCase() === lower);
}

/** Fills `over` into `base`, `over` winning; null-prototype, as the payload is user-keyed. */
function merge(base: unknown, over: Obj): Obj {
  const out = Object.assign(
    Object.create(null) as Obj,
    isObj(base) ? base : {},
  );
  for (const [k, v] of Object.entries(over))
    out[k] = isObj(v) ? merge(out[k], v) : v;
  return out;
}

/**
 * The `github` context worked out from the Event (#8 §6). Fields the event doesn't define
 * are left out, so they resolve to empty as on GitHub.
 */
function githubContext({ event, repo }: Scenario): { event: Obj } & Obj {
  const pr =
    event.name === "pull_request" || event.name === "pull_request_target";
  // A bare name is a branch, as the Scenario form takes it.
  const given = event.ref ?? repo.defaultBranch!;
  const ref = given.startsWith("refs/") ? given : `refs/heads/${given}`;
  const short = (r: string) => r.replace(/^refs\/(heads|tags)\//, "");
  const fork = event.actor === "fork";
  const computed: Obj = pr
    ? {
        pull_request: {
          head: {
            sha: "<head_sha>",
            ref: short(ref),
            repo: {
              fork,
              // Left out while unknown, so reading it needs the owner/repo fact.
              ...((fork || repo.repository !== undefined) && {
                full_name: fork ? "<fork>" : repo.repository,
              }),
            },
          },
          merge_commit_sha: "<merge_commit_sha>",
        },
      }
    : { head_commit: { message: event.message } };
  if (event.type !== undefined) computed.action = event.type;
  // DB-4: pull_request_target runs on the default branch's last commit.
  const merged = event.name === "pull_request";
  return {
    event_name: event.name,
    event: merge(event.payload, computed),
    ref: merged
      ? "refs/pull/<number>/merge"
      : pr
        ? `refs/heads/${repo.defaultBranch}`
        : ref,
    ref_name: merged ? "<number>/merge" : pr ? repo.defaultBranch : short(ref),
    ...(pr && {
      head_ref: short(ref),
      base_ref: event.base ?? repo.defaultBranch,
    }),
    sha: merged ? "<merge_commit_sha>" : "<sha>",
    run_id: "<run_id>",
  };
}
