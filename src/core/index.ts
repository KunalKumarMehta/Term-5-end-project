import { accessVerdicts } from "./access";
import { jobVerdicts } from "./jobs";
import { parseWorkflowFile, type Diagnostic, type Span } from "./parser";
import {
  ASSUMED,
  validateScenario,
  withDefaults,
  type Scenario,
} from "./scenario";
import { filterDiagnostics, trigger } from "./triggers";

export { PLATFORM_BASELINE } from "./baseline";
export type { Diagnostic, Span } from "./parser";
export { RULES, type Rule } from "./rules";
export {
  SHOW_DEFAULTS,
  setScenarioValue,
  settleValue,
  validateScenario,
  withDefaults,
} from "./scenario";
export type * from "./scenario";

export interface WorkflowFile {
  /** Path from the repo root, such as `.github/workflows/ci.yml`. */
  path: string;
  text: string;
}

export interface Cause {
  /** One rule ID from the rule catalogue. */
  rule: string;
  /** The YAML the cause rests on. */
  spans: Span[];
  /** The Scenario inputs it used. */
  inputs: { path: string; value: unknown }[];
}

export interface Verdict {
  /** The outcome-independent subject key (ADR 0001). */
  key: string;
  value: string;
  /** The Explanation, ordered from the root cause. */
  causes: Cause[];
  /** Only on an `uncertain` Verdict, and only when there are at most 3 outcomes. */
  possible?: string[];
  /** Only on an `uncertain` Verdict: the input paths that would decide it. */
  settle?: string[];
  /** Beside a non-empty `settle`, one per path in its order, for the Settle it box. */
  hints?: SettleHint[];
}

export interface SettleHint {
  path: string;
  /** Where the value comes from, such as "output `src` of `dorny/paths-filter` in job `changes`". */
  text: string;
  /** The literals the expression compares the path with: the one-click values. */
  candidates: unknown[];
}

/** An Assumption whose key matches no subject: "assumed subject not found". */
export interface UnmatchedAssumption {
  key: string;
  /** Job keys in the same file or with the same job id. */
  candidates: string[];
}

export interface SimulationResult {
  verdicts: Verdict[];
  /** Sorted by path, then position. */
  diagnostics: Diagnostic[];
  unmatchedAssumptions: UnmatchedAssumption[];
}

const SUPPORTED = new Set(["push", "pull_request"]);
// GitHub's 500 KB workflow file limit (PL-9), read as KiB.
const MAX_BYTES = 500 * 1024;
// The core has no DOM or Node types, so no TextEncoder.
function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return bytes;
}
const loaded = /^\.github\/workflows\/([^/]+\.ya?ml)$/;

/** Whether GitHub reads the file at this path: a `.yml`/`.yaml` file directly in `.github/workflows/`. */
export const isLoaded = (path: string): boolean => loaded.test(path);

/**
 * Simulates the Workflow set for the Scenario. Pure, synchronous and deterministic.
 * Throws a TypeError when the Scenario doesn't match its schema.
 */
export function simulate(
  files: WorkflowFile[],
  input: Scenario,
): SimulationResult {
  const problems = validateScenario(input);
  if (problems.length > 0) throw new TypeError(problems.join("; "));
  const { scenario, filled } = withDefaults(input);
  const { event } = scenario;

  // Diagnostics never depend on the Scenario, so an unsupported Event still reports them.
  const parsed = files.flatMap((file) => {
    const key = loaded.exec(file.path)?.[1];
    return key === undefined
      ? []
      : [
          {
            key,
            bytes: utf8Length(file.text),
            ...parseWorkflowFile(file.path, file.text),
          },
        ];
  });
  // Branch and tag filter checks need a file the parser accepted.
  for (const p of parsed)
    if (p.diagnostics.length === 0) p.diagnostics = filterDiagnostics(p);
  const diagnostics = parsed
    .flatMap((p) => p.diagnostics)
    .sort(
      (a, b) => compare(a.path, b.path) || a.line - b.line || a.col - b.col,
    );

  // Events outside v1 (and those later tickets add), and the impossible combinations (#6):
  // a fork contributor pushing, and a private repo with a fork contributor (WN-3).
  const fork = event.actor === "fork";
  const privateFork = fork && scenario.repo.visibility === "private";
  if (
    !SUPPORTED.has(event.name) ||
    (fork && event.name === "push") ||
    privateFork
  ) {
    const inputs = [
      { path: "event.name", value: event.name },
      { path: "event.actor", value: event.actor },
      ...(privateFork ? [{ path: "repo.visibility", value: "private" }] : []),
    ];
    return {
      verdicts: [
        {
          key: "event",
          value: "unsupported",
          causes: [{ rule: "WN-3", spans: [], inputs }],
        },
      ],
      diagnostics,
      unmatchedAssumptions: [],
    };
  }

  const verdicts = evaluate(parsed, scenario);
  // WN-5 (#8 §3): an assumed default decides a Verdict when another allowed value of the
  // field would change its value. It follows the root, never replaces it.
  for (const path of filled) {
    const allowed = ASSUMED.get(path);
    if (!allowed) continue;
    const [group, field] = path.split(".") as ["repo" | "event", string];
    const value = (scenario[group] as unknown as Record<string, unknown>)[
      field
    ];
    const decided = new Set<string>();
    for (const other of allowed) {
      if (other === value) continue;
      // Shallow copies keep the null-prototype maps withDefaults made.
      const alt = {
        ...scenario,
        [group]: { ...scenario[group], [field]: other },
      };
      const values = new Map(
        evaluate(parsed, alt).map((v) => [v.key, v.value]),
      );
      for (const v of verdicts)
        if (values.get(v.key) !== v.value) decided.add(v.key);
    }
    // A new array: Verdicts may share a cause chain (a no-run job copies its workflow's).
    for (const v of verdicts)
      if (decided.has(v.key))
        v.causes = [
          ...v.causes,
          { rule: "WN-5", spans: [], inputs: [{ path, value }] },
        ];
  }
  // Code-unit order, so the result never depends on the host's locale.
  verdicts.sort((a, b) => compare(a.key, b.key));
  return {
    verdicts,
    diagnostics,
    unmatchedAssumptions: unmatched(scenario, verdicts),
  };
}

// An Assumption names a job key ("fails") or one of its outputs (`<job key> › outputs.<name>`).
function unmatched(
  scenario: Scenario,
  verdicts: Verdict[],
): UnmatchedAssumption[] {
  const jobs = verdicts
    .map((v) => v.key.split(" › "))
    .filter((parts) => parts.length === 2);
  return Object.keys(scenario.assume ?? {}).flatMap((key) => {
    const [file, id] = key.split(" › ");
    if (jobs.some(([f, j]) => f === file && j === id)) return [];
    const candidates = jobs
      .filter(([f, j]) => f === file || j === id)
      .map((parts) => parts.join(" › "));
    return [{ key, candidates }];
  });
}

type Parsed = ReturnType<typeof parseWorkflowFile> & {
  key: string;
  bytes: number;
};

/** The Verdicts of the files GitHub would accept, unsorted. */
function evaluate(parsed: Parsed[], scenario: Scenario): Verdict[] {
  const { event, repo } = scenario;
  const verdicts: Verdict[] = [];
  for (const { key, bytes, ...file } of parsed) {
    // A file GitHub would reject gets no Verdicts.
    if (file.diagnostics.length > 0) continue;
    // PL-9: GitHub starts no runs from it, but it isn't a Diagnostic, so its keys stay (ADR 0001).
    const workflow: Verdict =
      bytes > MAX_BYTES
        ? {
            key,
            value: "skipped",
            causes: [{ rule: "PL-9", spans: [], inputs: [] }],
          }
        : {
            key,
            ...awaiting(trigger(file, event, repo.defaultBranch!), event),
          };
    verdicts.push(
      workflow,
      ...jobVerdicts(key, file, workflow, scenario),
      ...accessVerdicts(key, file, scenario),
    );
  }
  return verdicts;
}

/**
 * A fork contributor's `pull_request` awaiting approval: a run GitHub would create is
 * `pending` (root FK-4, then PL-5), so its jobs are `no-run` (#8 §2).
 */
function awaiting(
  verdict: Omit<Verdict, "key">,
  event: Scenario["event"],
): Omit<Verdict, "key"> {
  if (event.actor !== "fork" || event.approval !== "awaiting") return verdict;
  if (verdict.value !== "runs" && !verdict.possible?.includes("runs"))
    return verdict;
  const causes = [
    {
      rule: "FK-4",
      spans: [],
      inputs: [{ path: "event.approval", value: "awaiting" }],
    },
    { rule: "PL-5", spans: [], inputs: [] },
    ...verdict.causes,
  ];
  if (verdict.value === "runs") return { value: "pending", causes };
  // An uncertain run stays uncertain, with pending in place of runs.
  return {
    ...verdict,
    causes,
    possible: verdict.possible!.map((p) => (p === "runs" ? "pending" : p)),
  };
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
