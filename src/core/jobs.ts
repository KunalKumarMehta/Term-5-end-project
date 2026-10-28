// Job Verdicts: `if:` with its implicit `success() &&`, `needs` propagation and the
// "job X fails" Assumption (JG-1..3, JG-11, WN-1, WN-2).
import type { Cause, Verdict } from "./index";
import {
  evaluateCondition,
  type JobSpans,
  type ParsedWorkflow,
  type Span,
} from "./parser";
import type { Scenario } from "./scenario";

type Conclusion = "success" | "failure" | "skipped";

interface Outcome {
  value: string;
  causes: Cause[];
  /** What `needs.<id>.result` reads. */
  conclusion: Conclusion;
  /** Whether this job or an ancestor failed, which is what a dependent's failure() reads. */
  failed: boolean;
}

const cause = (
  rule: string,
  span: Span | undefined,
  inputs: Cause["inputs"] = [],
): Cause => ({ rule, spans: span ? [span] : [], inputs });

/** One Verdict per job of a loaded GitHub workflow, keyed `<file> › <jobId>`. */
export function jobVerdicts(
  file: string,
  parsed: ParsedWorkflow,
  workflow: Verdict,
  scenario: Scenario,
): Verdict[] {
  const key = (id: string) => `${file} › ${id}`;
  const ids = parsed.jobs.map((j) => j.id.value);
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
  const contexts = {
    github: githubContext(scenario),
    vars: { ...scenario.repo.vars },
    inputs: {},
  };

  // JG-11: GitHub's docs don't say how a dependent sees a failing job with job-level
  // `continue-on-error: true`, so each such job is read both as failed and as succeeded.
  // shortcut: 2^n branches for n such jobs, fine for the few a workflow has.
  const open = ids.filter((id) => fails(id) && spans(id).continueOnError);

  const branch = (succeeds: Set<string>) => {
    const memo = new Map<string, Outcome>();
    const outcome = (id: string): Outcome => {
      const known = memo.get(id);
      if (known) return known;
      const job = jobs.get(id)!;
      const at = spans(id);
      const needs = (job.needs ?? []).map((n) => outcome(n.value));
      const results = (all?: Conclusion) =>
        Object.fromEntries(
          (job.needs ?? []).map((n, i) => [
            n.value,
            { result: all ?? needs[i]!.conclusion, outputs: {} },
          ]),
        );
      const failed = needs.some((n) => n.failed);
      const blocker = needs.find((n) => n.conclusion !== "success");
      const runs = evaluateCondition(
        job.if.expression,
        { ...contexts, needs: results() },
        { success: !blocker, failure: failed },
      );
      let result: Outcome;
      if (runs && fails(id))
        result = {
          value: "fails",
          causes: [cause("WN-1", at.id, [{ path: key(id), value: "fails" }])],
          conclusion: succeeds.has(id) ? "success" : "failure",
          failed: failed || !succeeds.has(id),
        };
      else if (runs)
        result = {
          value: "runs",
          causes: [
            // A dependent that runs past a failed or skipped need does so by its status function.
            ...(blocker
              ? [cause("JG-1", at.if ?? at.id), ...blocker.causes]
              : []),
            cause("WN-2", at.id),
          ],
          conclusion: "success",
          failed,
        };
      else {
        // Skipped by `needs` when the same `if:` would pass were every need a success.
        const byNeeds =
          blocker &&
          evaluateCondition(
            job.if.expression,
            { ...contexts, needs: results("success") },
            { success: true, failure: false },
          );
        const implicit =
          at.if && job.if.expression.startsWith("success() && (");
        result = {
          value: "skipped",
          causes: byNeeds
            ? [
                ...blocker.causes,
                cause("JG-1", at.needs ?? at.id),
                ...(implicit ? [cause("JG-2", at.if)] : []),
              ]
            : [cause("JG-3", at.if ?? at.id)],
          conclusion: "skipped",
          failed,
        };
      }
      memo.set(id, result);
      return result;
    };
    return new Map(ids.map((id) => [id, outcome(id)]));
  };

  // Branch 0 reads every open job as failed: the Explanation of a decided job comes from it.
  const branches = Array.from({ length: 2 ** open.length }, (_, mask) =>
    branch(new Set(open.filter((_, i) => mask & (1 << i)))),
  );
  return ids.map((id) => {
    const base = branches[0]!.get(id)!;
    const possible = [...new Set(branches.map((b) => b.get(id)!.value))];
    if (possible.length === 1)
      return { key: key(id), value: base.value, causes: base.causes };
    const source = open.find((o) => upstream(jobs, id).has(o))!;
    return {
      key: key(id),
      value: "uncertain",
      causes: [cause("JG-11", spans(source).continueOnError), ...base.causes],
      possible: possible.sort(),
      settle: [],
    };
  });
}

function upstream(
  jobs: Map<string, ParsedWorkflow["jobs"][number]>,
  id: string,
  seen = new Set<string>(),
): Set<string> {
  for (const n of jobs.get(id)?.needs ?? [])
    if (!seen.has(n.value)) upstream(jobs, n.value, seen.add(n.value));
  return seen;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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
function githubContext({ event, repo }: Scenario): Obj {
  const pr =
    event.name === "pull_request" || event.name === "pull_request_target";
  // A bare name is a branch, as the Scenario form takes it.
  const given = event.ref ?? repo.defaultBranch!;
  const ref = given.startsWith("refs/") ? given : `refs/heads/${given}`;
  const short = (r: string) => r.replace(/^refs\/(heads|tags)\//, "");
  const computed: Obj = pr
    ? {
        pull_request: {
          head: {
            sha: "<head_sha>",
            ref: short(ref),
            repo: {
              fork: event.actor === "fork",
              full_name: event.actor === "fork" ? "<fork>" : repo.repository,
            },
          },
          merge_commit_sha: "<merge_commit_sha>",
        },
      }
    : { head_commit: { message: event.message } };
  if (event.type !== undefined) computed.action = event.type;
  return {
    event_name: event.name,
    event: merge(event.payload, computed),
    ref: pr ? "refs/pull/<number>/merge" : ref,
    ref_name: pr ? "<number>/merge" : short(ref),
    ...(pr && {
      head_ref: short(ref),
      base_ref: event.base ?? repo.defaultBranch,
    }),
    sha: pr ? "<merge_commit_sha>" : "<sha>",
    run_id: "<run_id>",
  };
}
