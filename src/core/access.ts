// Access keys (#6, ADR 0001): every job with steps gets its 17 token scopes and its secrets,
// computed as if the job runs (PERM-1..6, PERM-8, FK-0, FK-2, FK-8, PL-16).
import type { Cause, Verdict } from "./index";
import type { ParsedWorkflow, Permissions, Span } from "./parser";
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
): Access {
  if (actor === "member") return access;
  const inputs = [{ path: "event.actor", value: actor }];
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

/** The access Verdicts of a loaded GitHub workflow's jobs with steps. */
export function accessVerdicts(
  file: string,
  parsed: ParsedWorkflow,
  scenario: Scenario,
): Verdict[] {
  const tokenDefault = scenario.repo.tokenDefault!;
  const actor = scenario.event.actor!;
  return parsed.jobs.flatMap((job) => {
    // shortcut: `uses:` callers get their callee's access with #66 (reusable workflows).
    if (job.type !== "job") return [];
    const key = `${file} › ${job.id.value}`;
    const spans = parsed.jobSpans.get(job.id.value);
    const own = spans?.permissions;
    // PERM-4: a job-level block replaces the workflow-level one; the two don't merge.
    const replaced =
      own && parsed.permissions
        ? [cause("PERM-4", parsed.permissions.span)]
        : [];
    const block = own ?? parsed.permissions;
    const tokens = SCOPES.map((name) => {
      const access = scope(name, block, tokenDefault);
      return {
        key: `${key} › token.${name}`,
        ...byActor(
          name,
          { ...access, causes: [...access.causes, ...replaced] },
          block !== undefined,
          actor,
        ),
      };
    });
    const actorInput = [{ path: "event.actor", value: actor }];
    const secrets: Verdict = {
      key: `${key} › secrets`,
      ...(actor === "fork"
        ? { value: "empty", causes: [cause("FK-2", undefined, actorInput)] }
        : actor === "dependabot"
          ? {
              value: "dependabot-only",
              causes: [cause("FK-8", undefined, actorInput)],
            }
          : {
              value: "available",
              causes: [
                cause("FK-0", undefined, actorInput),
                ...(spans?.environment
                  ? [cause("PL-16", spans.environment)]
                  : []),
              ],
            }),
    };
    return [...tokens, secrets];
  });
}
