// Check names (RQ-0, RQ-9 revised, #73): the checks a GitHub workflow's jobs report, worked out
// from the files and the Scenario's values, for matching required checks and for "Require every produced check".
import { isMapping } from "@actions/workflow-parser";
import type { WorkflowJob } from "@actions/workflow-parser/model/workflow-template";
import type { ParsedWorkflow, Span } from "./parser";
import { calleeKey, calls } from "./reusable";

export interface Named {
  /** The job key after `<file> › `: a job id, or `<caller>/<callee>` for a local callee's job. */
  id: string;
  /** Its check name (RQ-0); undefined while a `name:` is an expression it can't evaluate. */
  name: string | undefined;
  /** What that `name:` expression needs (WN-4). */
  needed?: string;
  /**
   * How the name is derived: a local callee's `<caller> / <callee>` (RQ-9), a matrix job's
   * prefix (RQ-9, undocumented), or a remote caller's `<caller> / …` prefix (WN-6).
   */
  via?: "callee" | "matrix" | "remote";
  /** A remote caller's `uses:`. */
  uses?: Span;
}

// A `strategy:` that isn't a mapping is an expression, which may hold a matrix.
export const isMatrix = (job: WorkflowJob) =>
  job.strategy !== undefined &&
  (!isMapping(job.strategy) || job.strategy.find("matrix") !== undefined);

/**
 * The checks a GitHub workflow's jobs report, a local callee's one level deep, each job's
 * `name:` evaluated by `nameOf` (checks.ts, against a Scenario).
 */
export function namesOf(
  file: ParsedWorkflow,
  files: Map<string, ParsedWorkflow>,
  nameOf: (job: WorkflowJob) => Pick<Named, "name" | "needed">,
): Named[] {
  const called = new Map(calls(file).map((c) => [c.job.id.value, c]));
  return file.jobs.flatMap((job): Named[] => {
    const id = job.id.value;
    const caller = nameOf(job);
    const call = called.get(id);
    if (!call)
      return [{ id, ...caller, ...(isMatrix(job) && { via: "matrix" }) }];
    if (call.path === undefined)
      return [{ id, ...caller, via: "remote", uses: call.span }];
    const callee = files.get(calleeKey(call.path) ?? "");
    return (callee?.jobs ?? []).map((inner) => {
      const own = nameOf(inner);
      const needed = caller.needed ?? own.needed;
      return {
        id: `${id}/${inner.id.value}`,
        name:
          caller.name === undefined || own.name === undefined
            ? undefined
            : `${caller.name} / ${own.name}`,
        ...(needed !== undefined && { needed }),
        via: isMatrix(inner) ? "matrix" : "callee",
      };
    });
  });
}
