// Access keys (#6, ADR 0001): every job with steps gets its 17 token scopes and its secrets,
// computed as if the job runs (PERM-1..8, FK-0, FK-2, FK-7, FK-8, PL-16); a local callee's jobs are
// capped by their caller (PERM-7, RU-1, RU-1a), and a remote caller gets its own (WN-6).
import type { ReusableWorkflowJob } from "@actions/workflow-parser/model/workflow-template";
import type { Cause, Verdict } from "./index";
import type { JobSpans, ParsedWorkflow, Permissions, Span } from "./parser";
import { isLocal } from "./reusable";
import type { Scenario } from "./scenario";

// PERM-5: the scopes as of today; `metadata` is always read and never configurable (PERM-9).
const SCOPES = [
  "actions",
  "artifact-metadata",
  "attestations",
  "checks",
  "code-quality",
  "contents",
  "copilot-requests",
  "deployments",
  "discussions",
  "id-token",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "security-events",
  "statuses",
  "vulnerability-alerts",
];
const WRITE_OR_NONE = new Set(["copilot-requests", "id-token"]);
const READ_OR_NONE = new Set(["vulnerability-alerts"]);
// PERM-1: a restricted token default reads only these.
const RESTRICTED = new Set(["contents", "packages"]);

const cause = (rule: string, span?: Span, inputs: Cause["inputs"] = []) => ({
  rule,
  spans: span ? [span] : [],
  inputs,
});

type Access = Omit<Verdict, "key">;

/** The level a scope holds when given `level` for all scopes, clamped by PERM-5. */
function clamp(
  scope: string,
  level: "read" | "write",
  causes: Cause[],
): Access {
  if (level === "read" && WRITE_OR_NONE.has(scope))
    return { value: "none", causes: [...causes, cause("PERM-5")] };
  if (level === "write" && READ_OR_NONE.has(scope))
    return { value: "read", causes: [...causes, cause("PERM-5")] };
  return { value: level, causes };
}

function scope(
  name: string,
  block: Permissions | undefined,
  tokenDefault: string,
): Access {
  if (block === undefined) {
    const baseline = cause("PERM-1", undefined, [
      { path: "repo.tokenDefault", value: tokenDefault },
    ]);
    if (tokenDefault === "restricted")
      return {
        value: RESTRICTED.has(name) ? "read" : "none",
        causes: [baseline],
      };
    // A permissive default lands these on read/write, a level they can't hold (#6, #8 §4).
    if (WRITE_OR_NONE.has(name))
      return {
        value: "uncertain",
        causes: [cause("PERM-8"), baseline],
        possible: ["none", "write"],
        settle: [],
      };
    return clamp(name, "write", [baseline]);
  }
  const listed = block.scopes.get(name);
  if (listed)
    return { value: listed.level, causes: [cause("PERM-3", listed.span)] };
  if (block.all === "read-all" || block.all === "write-all")
    return clamp(name, block.all === "read-all" ? "read" : "write", [
      cause("PERM-3", block.span),
    ]);
  return { value: "none", causes: [cause("PERM-3", block.span)] };
}

/**
 * A fork's or Dependabot's run on top of the resolved level (PERM-2, PERM-6, PERM-8, FK-8).
 * The actor's rule is the root where it changes the level, and Dependabot's is always cited.
 */
function byActor(
  name: string,
  access: Access,
  blocked: boolean,
  actor: string,
  target = false,
): Access {
  const inputs = [{ path: "event.actor", value: actor }];
  if (target)
    return {
      ...access,
      causes: [...access.causes, cause("FK-7", undefined, inputs)],
    };
  if (actor === "member") return access;
  const fk8 = actor === "dependabot" ? [cause("FK-8", undefined, inputs)] : [];
  // GitHub doesn't document what these get, so nothing can settle it.
  if (access.value === "write" && WRITE_OR_NONE.has(name))
    return {
      value: "uncertain",
      causes: [cause("PERM-8", undefined, inputs), ...access.causes, ...fk8],
      possible: ["none", "write"],
      settle: [],
    };
  if (access.value !== "write")
    return { ...access, causes: [...access.causes, ...fk8] };
  // Dependabot starts read-only, but its `permissions:` can raise it (FK-8).
  if (actor === "dependabot")
    return blocked
      ? { ...access, causes: [...access.causes, ...fk8] }
      : { value: "read", causes: [...fk8, ...access.causes] };
  // A fork's pull_request: every write becomes read, even one its block asks for.
  const root = access.causes[0]!;
  return {
    value: "read",
    causes: [
      { rule: "PERM-2", spans: root.spans, inputs },
      ...(blocked ? [cause("PERM-6")] : []),
      ...access.causes,
    ],
  };
}

const ORDER: Record<string, number> = { none: 0, read: 1, write: 2 };

/** A job's levels before the actor's rules: its block, else the workflow's (PERM-4), else the baseline. */
function resolve(parsed: ParsedWorkflow, id: string, tokenDefault: string) {
  const own = parsed.jobSpans.get(id)?.permissions;
  // PERM-4: a job-level block replaces the workflow-level one; the two don't merge.
  const replaced =
    own && parsed.permissions ? [cause("PERM-4", parsed.permissions.span)] : [];
  const block = own ?? parsed.permissions;
  const level = (name: string): Access => {
    const access = scope(name, block, tokenDefault);
    return { ...access, causes: [...access.causes, ...replaced] };
  };
  return { block, level };
}

/** PERM-7: a callee keeps or lowers its caller's level, and with no block of its own takes it. */
function capped(access: Access | undefined, cap: Access, span: Span): Access {
  const perm7 = cause("PERM-7", span);
  if (!access || (cap.value === "uncertain" && access.value !== "none"))
    return { ...cap, causes: [...cap.causes, perm7] };
  if (ORDER[access.value]! > ORDER[cap.value]!)
    return { ...cap, causes: [perm7, ...cap.causes, ...access.causes] };
  return access;
}

/** What the run has in `secrets` for its actor (FK-0, FK-2, FK-8, PL-16). */
function runSecrets(
  actor: string,
  environment: Span | undefined,
  target = false,
): Access {
  const inputs = [{ path: "event.actor", value: actor }];
  const env = environment ? [cause("PL-16", environment)] : [];
  if (target)
    return {
      value: "available",
      causes: [cause("FK-7", undefined, inputs), ...env],
    };
  if (actor === "fork")
    return { value: "empty", causes: [cause("FK-2", undefined, inputs)] };
  if (actor === "dependabot")
    return {
      value: "dependabot-only",
      causes: [cause("FK-8", undefined, inputs)],
    };
  return {
    value: "available",
    causes: [cause("FK-0", undefined, inputs), ...env],
  };
}

/**
 * RU-1: no `secrets:` passes nothing but `GITHUB_TOKEN`; a mapping or `inherit` passes what
 * the caller's run has, which a fork or Dependabot run caps (RU-1a).
 */
function passed(
  caller: JobSpans,
  passes: boolean,
  run: Access,
  actor: string,
  target = false,
) {
  if (!passes) return { value: "empty", causes: [cause("RU-1", caller.uses)] };
  const ru1 = cause("RU-1", caller.secrets);
  // FK-7: the run has the base repo's secrets, so the actor caps nothing (RU-1a).
  if (actor === "member" || target)
    return { ...run, causes: [ru1, ...run.causes] };
  const ru1a = cause("RU-1a", undefined, [
    { path: "event.actor", value: actor },
  ]);
  return { ...run, causes: [ru1a, ...run.causes, ru1] };
}

const passes = (job: ReusableWorkflowJob) =>
  job["inherit-secrets"] === true || job["secret-values"] !== undefined;

/** A local caller job, whose `permissions:` cap its callee's jobs and whose `secrets:` feed them. */
/** Whether a subject key is a job's token scope or secrets (#6). */
export const isAccess = (key: string): boolean =>
  / › (token\.[a-z-]+|secrets)$/.test(key);

export interface Caller {
  parsed: ParsedWorkflow;
  job: ReusableWorkflowJob;
}

/**
 * The access Verdicts of a loaded GitHub workflow's jobs with steps, keyed `<prefix><jobId>`,
 * and of its remote reusable callers (#8 §10). A local callee's jobs pass their `caller`.
 */
export function accessVerdicts(
  prefix: string,
  parsed: ParsedWorkflow,
  scenario: Scenario,
  caller?: Caller,
): Verdict[] {
  const tokenDefault = scenario.repo.tokenDefault!;
  const actor = scenario.event.actor!;
  // FK-7: pull_request_target gets the base repo's token and secrets, whoever opened the PR.
  const target = scenario.event.name === "pull_request_target";
  const cap =
    caller && resolve(caller.parsed, caller.job.id.value, tokenDefault);
  const callerSpans =
    caller && caller.parsed.jobSpans.get(caller.job.id.value)!;
  return parsed.jobs.flatMap((job) => {
    const key = `${prefix}${job.id.value}`;
    const spans = parsed.jobSpans.get(job.id.value);
    if (job.type !== "job")
      // A local caller has only its run key: its callee's jobs carry the access (PERM-7).
      return caller || isLocal(job.ref.value) || !spans
        ? []
        : remote(
            key,
            job,
            spans,
            scenario,
            resolve(parsed, job.id.value, tokenDefault),
          );
    const { block, level } = resolve(parsed, job.id.value, tokenDefault);
    const tokens = SCOPES.map((name) => {
      const access = cap
        ? capped(
            block && level(name),
            cap.level(name),
            cap.block?.span ?? callerSpans!.uses!,
          )
        : level(name);
      return {
        key: `${key} › token.${name}`,
        ...byActor(
          name,
          access,
          (block ?? cap?.block) !== undefined,
          actor,
          target,
        ),
      };
    });
    const run = runSecrets(actor, spans?.environment, target);
    const secrets: Verdict = {
      key: `${key} › secrets`,
      ...(caller
        ? passed(callerSpans!, passes(caller.job), run, actor, target)
        : run),
    };
    return [...tokens, secrets];
  });
}

/** The levels each scope can hold (PERM-5). */
const holds = (name: string) =>
  WRITE_OR_NONE.has(name)
    ? ["none", "write"]
    : READ_OR_NONE.has(name)
      ? ["none", "read"]
      : ["none", "read", "write"];

/**
 * A remote reusable caller (#8 §10): its callee is never fetched (WN-6), so its secrets are
 * decided from its `secrets:` and its token scopes are Uncertain at or below its cap (PERM-7).
 */
function remote(
  key: string,
  job: ReusableWorkflowJob,
  spans: JobSpans,
  scenario: Scenario,
  { block, level }: ReturnType<typeof resolve>,
): Verdict[] {
  const actor = scenario.event.actor!;
  const target = scenario.event.name === "pull_request_target";
  const wn6 = cause("WN-6", spans.uses);
  const perm7 = cause("PERM-7", block?.span ?? spans.uses);
  const tokens = SCOPES.map((name): Verdict => {
    const cap = byActor(name, level(name), block !== undefined, actor, target);
    const max = cap.value === "uncertain" ? "write" : cap.value;
    const possible = holds(name).filter((l) => ORDER[l]! <= ORDER[max]!);
    return {
      key: `${key} › token.${name}`,
      ...(possible.length === 1
        ? { value: possible[0]!, causes: [...cap.causes, perm7, wn6] }
        : {
            value: "uncertain",
            causes: [wn6, perm7, ...cap.causes],
            possible,
            settle: [],
          }),
    };
  });

  const run = runSecrets(actor, undefined, target);
  let secrets: Access = passed(spans, passes(job), run, actor, target);
  // `inherit` works only within one org or enterprise: decided when the callee's owner is the repo's.
  if (job["inherit-secrets"] === true && run.value !== "empty") {
    const owner = scenario.repo.repository?.split("/")[0]?.toLowerCase();
    if (owner !== job.ref.value.split("/")[0]!.toLowerCase())
      secrets = {
        value: "uncertain",
        causes: [wn6, ...secrets.causes],
        possible: [run.value, "empty"].sort(),
        settle: [],
      };
    else
      secrets.causes = secrets.causes.map((c) =>
        c.rule === "RU-1"
          ? {
              ...c,
              inputs: [
                { path: "repo.repository", value: scenario.repo.repository },
              ],
            }
          : c,
      );
  }
  if (secrets.value !== "uncertain")
    secrets = { ...secrets, causes: [...secrets.causes, wn6] };
  return [...tokens, { key: `${key} › secrets`, ...secrets }];
}
