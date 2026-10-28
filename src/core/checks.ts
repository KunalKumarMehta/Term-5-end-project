// Merge readiness (#6, #71): one Verdict per required check, keyed `check › <name>`, worked out
// from the jobs whose check name (RQ-0) it is, on the head SHA.
import type { Cause, Verdict } from "./index";
import type { Scenario } from "./scenario";
import { PR_DEFAULT_TYPES } from "./triggers";

/** A job that reports a check on the head SHA, with its GitHub workflow's Verdict. */
export interface Producer {
  /** Its check name (RQ-0); undefined while its `name:` is an expression. */
  name: string | undefined;
  job: Verdict;
  workflow: Verdict;
}

const cause = (rule: string, inputs: Cause["inputs"] = []): Cause => ({
  rule,
  spans: [],
  inputs,
});

export function checkVerdicts(
  producers: Producer[],
  { event, repo }: Scenario,
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
  return names.map((name) => ({
    key: `check › ${name}`,
    ...badge(name, producers, notes),
  }));
}

function badge(
  name: string,
  producers: Producer[],
  notes: Cause[],
): Omit<Verdict, "key"> {
  // Nothing reports the check, which GitHub's guidance (RQ-8) answers.
  const pending = (...causes: Cause[]) => ({
    value: "pending and blocks merge",
    causes: [...causes, cause("RQ-8"), ...notes],
  });
  // shortcut: exact names and the first producer only; #72 adds case-only matches, `name:`
  // expressions (WN-4) and duplicate producers, all Uncertain.
  const producer = producers.find((p) => p.name === name);
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
  // A filter or commit-message skip creates no run, so no check run.
  if (job.value === "no-run" && workflow.value === "skipped")
    return pending(cause("RQ-1"), ...job.causes);
  // shortcut: May not block, Fails and blocks merge and the Uncertain badge's own rules arrive
  // with #72; until then the producer's chain stands behind an Uncertain badge.
  return {
    value: "uncertain",
    causes: [...job.causes, ...notes],
    settle: job.settle ?? [],
    ...(job.hints && { hints: job.hints }),
  };
}
