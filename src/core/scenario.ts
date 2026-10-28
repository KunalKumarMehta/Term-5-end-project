import type { Scenario } from "./generated/scenario";
import validate from "./generated/validate-scenario";

export type * from "./generated/scenario";

interface ValidateFn {
  (value: unknown): boolean;
  errors?: { instancePath: string; message?: string }[] | null;
}

/** Checks a Scenario against `schemas/scenario.schema.json`; returns one message per problem. */
export function validateScenario(value: unknown): string[] {
  const check = validate as ValidateFn;
  if (check(value)) return [];
  return (check.errors ?? []).map(
    (e) => `${e.instancePath || "scenario"} ${e.message ?? "is invalid"}`,
  );
}

interface Default {
  path: string[];
  value: unknown;
  /** How `whynorun show` and the README list it, for the defaults `show` writes out. */
  show?: string;
}

// The one defaults table. Every defaulted field is written out (#8 §11); the date never is.
const DEFAULTS: Default[] = [
  { path: ["repo", "visibility"], value: "public", show: "Visibility: public" },
  {
    path: ["repo", "predates"],
    value: true,
    show: "Created before 2026-09-17: yes",
  },
  {
    path: ["repo", "defaultBranch"],
    value: "main",
    show: "Default branch: `main`",
  },
  {
    path: ["repo", "tokenDefault"],
    value: "restricted",
    show: "Token default: restricted",
  },
  {
    path: ["repo", "eventPolicy"],
    value: "none",
    show: "`pull_request_target` event policy: none",
  },
  {
    path: ["event", "approval"],
    value: "approved",
    show: "Approval of a fork contributor's run: approved",
  },
  { path: ["event", "actor"], value: "member" },
  { path: ["event", "changed"], value: [] },
  { path: ["event", "payload"], value: {} },
  { path: ["followUp", "actor"], value: "member" },
  { path: ["followUp", "approval"], value: "approved" },
  { path: ["followUp", "changed"], value: [] },
  { path: ["followUp", "payload"], value: {} },
  { path: ["followUp", "runA"], value: "in-progress" },
  { path: ["followUp", "pendingRuns"], value: 0 },
  { path: ["repo", "required"], value: [] },
  { path: ["repo", "strict"], value: false },
  { path: ["repo", "mergeQueue"], value: false },
  { path: ["repo", "vars"], value: {} },
  { path: ["assume"], value: {} },
];

/** The assumed defaults `whynorun show` writes out, as the README lists them. */
export const SHOW_DEFAULTS: readonly string[] = DEFAULTS.flatMap((d) =>
  d.show ? [d.show] : [],
);

type Obj = Record<string, unknown>;

// Maps keyed by the Maintainer: null-prototype, and read only with Object.hasOwn (#14 §6.7).
const USER_MAPS = [
  ["event", "payload"],
  ["followUp", "payload"],
  ["repo", "vars"],
  ["assume"],
];

/**
 * Writes every defaulted field out and reports which fields it filled, as dotted paths.
 * A Follow-up event's fields are filled only when the Scenario has one.
 */
export function withDefaults(input: Scenario): {
  scenario: Scenario;
  filled: string[];
} {
  const scenario = JSON.parse(JSON.stringify(input)) as Obj;
  const filled: string[] = [];
  for (const { path, value } of DEFAULTS) {
    const parent = walk(scenario, path.slice(0, -1));
    const field = path.at(-1)!;
    if (parent === undefined || Object.hasOwn(parent, field)) continue;
    parent[field] = JSON.parse(JSON.stringify(value));
    filled.push(path.join("."));
  }
  for (const path of USER_MAPS) {
    const parent = walk(scenario, path.slice(0, -1));
    const field = path.at(-1)!;
    if (parent && Object.hasOwn(parent, field))
      parent[field] = Object.assign(Object.create(null), parent[field]);
  }
  return { scenario: scenario as unknown as Scenario, filled };
}

function walk(node: Obj, path: string[]): Obj | undefined {
  let at: unknown = node;
  for (const seg of path) {
    if (typeof at !== "object" || at === null || !Object.hasOwn(at, seg))
      return undefined;
    at = (at as Obj)[seg];
  }
  return typeof at === "object" && at !== null ? (at as Obj) : undefined;
}

const REFUSED = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Returns a copy of the Scenario with `value` at `path` (one segment per key, so a
 * segment may hold dots or ` › `), creating null-prototype objects on the way.
 * Refuses any path through `__proto__`, `prototype` or `constructor`.
 */
export function setScenarioValue(
  scenario: Scenario,
  path: readonly string[],
  value: unknown,
): Scenario {
  if (path.length === 0 || path.some((seg) => REFUSED.has(seg)))
    throw new Error(`refused Scenario path: ${path.join(".")}`);
  const copy = JSON.parse(JSON.stringify(scenario)) as Obj;
  let node = copy;
  for (const seg of path.slice(0, -1)) {
    const next = Object.hasOwn(node, seg) ? node[seg] : undefined;
    node =
      typeof next === "object" && next !== null
        ? (next as Obj)
        : (node[seg] = Object.create(null) as Obj);
  }
  node[path.at(-1)!] = value;
  return copy as unknown as Scenario;
}

// What #8 §6 works out from the Event, so a value for it goes on the Event's own fields.
const FROM_EVENT = new Set([
  "event_name",
  "ref",
  "ref_name",
  "base_ref",
  "head_ref",
  "sha",
  "run_id",
]);
const FROM_EVENT_PAYLOAD = [
  "action",
  "pull_request.head.sha",
  "pull_request.head.ref",
  "pull_request.head.repo.fork",
  "pull_request.head.repo.full_name",
  "pull_request.merge_commit_sha",
  "head_commit.message",
];

/**
 * Returns a copy of the Scenario with a `settle` path's value stored where #8 §5 puts it: a
 * job output as an Assumption, `vars.<NAME>` as a repository variable, `github.event.*` on
 * the main Event or the Follow-up event (a `.*.<field>` path takes a list), and the
 * `owner/repo`, actor login and event policy fields directly. Throws on a path no Scenario
 * input holds: `matrix.*`, `steps.*`, function results and what the Event works out.
 */
export function settleValue(
  scenario: Scenario,
  path: string,
  value: unknown,
  on: "event" | "followUp" = "event",
): Scenario {
  const refuse = (why: string): never => {
    throw new Error(`refused \`${path}\`: ${why}`);
  };
  const set = (at: string[], v = value) => setScenarioValue(scenario, at, v);
  if (/[()]/.test(path))
    refuse("function results such as hashFiles() exist only at run time");
  if (path.includes(" › ")) {
    if (!/^[^›]+ › [^›]+ › outputs\.[^›]+$/.test(path))
      refuse("only a job's output is settled by its key");
    return set(["assume", path], String(value));
  }
  const segs = path.split(".");
  const [context, field] = segs;
  if (context === "matrix") refuse("there's no matrix expansion");
  if (context === "steps")
    refuse("step outputs exist only at run time: settle the job's output");
  if (context === "vars") {
    if (segs.length !== 2) refuse("a repository variable is `vars.<NAME>`");
    return set(["repo", "vars", field!], String(value));
  }
  if (path === "repo.repository" || path === "github.repository")
    return set(["repo", "repository"], String(value));
  if (path === "event.login" || path === "github.actor")
    return set([on, "login"], String(value));
  if (path === "repo.eventPolicy") return set(["repo", "eventPolicy"]);
  if (context !== "github") refuse("no Scenario input holds it");
  if (FROM_EVENT.has(field!))
    refuse("it is worked out from the Event: set it on the Event");
  if (field !== "event" || segs.length < 3)
    refuse("it exists only at run time");
  const rest = segs.slice(2);
  const joined = rest.join(".");
  if (
    FROM_EVENT_PAYLOAD.some((p) => p === joined || p.startsWith(`${joined}.`))
  )
    refuse("it is worked out from the Event: set it on the Event");
  const star = rest.indexOf("*");
  if (star < 0) return set([on, "payload", ...rest]);
  const item = rest[star + 1];
  if (star !== rest.length - 2 || !Array.isArray(value) || REFUSED.has(item!))
    refuse("a `.*.<field>` path takes a list of values");
  return set(
    [on, "payload", ...rest.slice(0, star)],
    (value as unknown[]).map((v) => ({ [item!]: v })),
  );
}
