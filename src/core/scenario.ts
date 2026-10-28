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
  /** Every allowed value, on the fields an assumed default is shown for as WN-5 (#8 §3). */
  allowed?: readonly unknown[];
}

// The one defaults table. Every defaulted field is written out (#8 §11); the date never is.
const DEFAULTS: Default[] = [
  {
    path: ["repo", "visibility"],
    value: "public",
    show: "Visibility: public",
    allowed: ["public", "private", "internal"],
  },
  {
    path: ["repo", "predates"],
    value: true,
    show: "Created before 2026-09-17: yes",
    allowed: [true, false],
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
    allowed: ["restricted", "permissive"],
  },
  {
    path: ["repo", "eventPolicy"],
    value: "none",
    show: "`pull_request_target` event policy: none",
    allowed: ["none", "allows", "blocks"],
  },
  {
    path: ["event", "approval"],
    value: "approved",
    show: "Approval of a fork contributor's run: approved",
    allowed: ["approved", "awaiting"],
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

/**
 * The fields whose assumed default is a WN-5 cause where it decides a Verdict, with their
 * allowed values. The default branch is free text, so it is shown as assumed but never WN-5.
 */
export const ASSUMED: ReadonlyMap<string, readonly unknown[]> = new Map(
  DEFAULTS.flatMap((d) => (d.allowed ? [[d.path.join("."), d.allowed]] : [])),
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
