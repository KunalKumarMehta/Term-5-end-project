import { parseWorkflowFile, type Span } from "./parser";
import { validateScenario, withDefaults, type Scenario } from "./scenario";
import { filterDiagnostics, trigger } from "./triggers";

export { PLATFORM_BASELINE } from "./baseline";
export type { Span } from "./parser";
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

/** A problem that makes GitHub reject a file; the file gets no Verdicts. */
export interface Diagnostic {
  /** The rule ID, when a rule in the catalogue says GitHub rejects it. */
  rule?: string;
  span: Span;
  /** GitHub's own error text where it has one. */
  message: string;
}

export interface SimulationResult {
  verdicts: Verdict[];
  diagnostics: Diagnostic[];
}

const SUPPORTED = new Set(["push", "pull_request"]);
const loaded = /^\.github\/workflows\/([^/]+\.ya?ml)$/;

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
  const { event, repo } = withDefaults(input).scenario;

  const readable: {
    key: string;
    parsed: ReturnType<typeof parseWorkflowFile>;
  }[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const file of files) {
    const key = loaded.exec(file.path)?.[1];
    if (key === undefined) continue;
    const parsed = parseWorkflowFile(file.path, file.text);
    // A file GitHub would reject gets no Verdicts; its parser Diagnostics land with #54.
    if (!parsed.ok) continue;
    const found = filterDiagnostics(file.path, parsed);
    if (found.length > 0) diagnostics.push(...found);
    else readable.push({ key, parsed });
  }

  // Until later tickets support them, every Event but a member's push or pull_request
  // is outside the model.
  if (!SUPPORTED.has(event.name) || event.actor !== "member") {
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
    };
  }

  const verdicts: Verdict[] = readable.map(({ key, parsed }) => ({
    key,
    ...trigger(parsed, event, repo.defaultBranch!),
  }));
  // Code-unit order, so the result never depends on the host's locale.
  verdicts.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { verdicts, diagnostics };
}
