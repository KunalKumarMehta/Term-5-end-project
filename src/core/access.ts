// Access keys (#6, ADR 0001): every job with steps gets its 17 token scopes and its secrets,
// computed as if the job runs (PERM-1, PERM-3..5, PERM-8, FK-0, PL-16).
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

/** The access Verdicts of a loaded GitHub workflow's jobs with steps. */
export function accessVerdicts(
  file: string,
  parsed: ParsedWorkflow,
  scenario: Scenario,
): Verdict[] {
  const tokenDefault = scenario.repo.tokenDefault!;
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
    const tokens = SCOPES.map((name) => {
      const access = scope(name, own ?? parsed.permissions, tokenDefault);
      return {
        key: `${key} › token.${name}`,
        ...access,
        causes: [...access.causes, ...replaced],
      };
    });
    const secrets: Verdict = {
      key: `${key} › secrets`,
      value: "available",
      causes: [
        cause("FK-0", undefined, [
          { path: "event.actor", value: scenario.event.actor },
        ]),
        ...(spans?.environment ? [cause("PL-16", spans.environment)] : []),
      ],
    };
    return [...tokens, secrets];
  });
}
