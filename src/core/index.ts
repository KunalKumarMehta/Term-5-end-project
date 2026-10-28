import { jobVerdicts } from "./jobs";
import { parseWorkflowFile, type Diagnostic, type Span } from "./parser";
import { validateScenario, withDefaults, type Scenario } from "./scenario";

export { PLATFORM_BASELINE } from "./baseline";
export type { Diagnostic, Span } from "./parser";
export { RULES, type Rule } from "./rules";
export {
  SHOW_DEFAULTS,
  setScenarioValue,
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
  const { scenario } = withDefaults(input);
  const { event } = scenario;

  // Diagnostics never depend on the Scenario, so an unsupported Event still reports them.
  const parsed = files.flatMap((file) => {
    const key = loaded.exec(file.path)?.[1];
    return key === undefined
      ? []
      : [{ key, ...parseWorkflowFile(file.path, file.text) }];
  });
  const diagnostics = parsed
    .flatMap((p) => p.diagnostics)
    .sort(
      (a, b) => compare(a.path, b.path) || a.line - b.line || a.col - b.col,
    );

  // Until later tickets support them, every Event but a member's push is outside the model.
  if (event.name !== "push" || event.actor !== "member") {
    const inputs = [
      { path: "event.name", value: event.name },
      { path: "event.actor", value: event.actor },
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

  const verdicts: Verdict[] = [];
  for (const { key, ...file } of parsed) {
    // A file GitHub would reject gets no Verdicts.
    if (file.diagnostics.length > 0) continue;
    const listed = Object.hasOwn(file.events, event.name);
    const span = listed ? file.onEntries.get(event.name) : file.onSpan;
    const workflow: Verdict = {
      key,
      value: listed ? "runs" : "skipped",
      causes: [
        {
          rule: "EV-0",
          spans: span ? [span] : [],
          inputs: [{ path: "event.name", value: event.name }],
        },
      ],
    };
    verdicts.push(workflow, ...jobVerdicts(key, file, workflow, scenario));
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

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
