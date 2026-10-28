import { accessVerdicts } from "./access";
import { checkVerdicts, type Producer } from "./checks";
import { jobVerdicts } from "./jobs";
import {
  checkName,
  parseWorkflowFile,
  type Diagnostic,
  type ParsedWorkflow,
  type Span,
} from "./parser";
import {
  brokenCalleeDiagnostics,
  callDiagnostics,
  calleeKey,
  calleeOnly,
  calls,
  contractError,
  inputsOf,
} from "./reusable";
import {
  ASSUMED,
  validateScenario,
  withDefaults,
  type Scenario,
} from "./scenario";
import { filterDiagnostics, trigger } from "./triggers";

export { isAccess } from "./access";
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

const SUPPORTED = new Set(["push", "pull_request", "pull_request_target"]);
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
  // Branch and tag filter and call checks need a file the parser accepted.
  const present = new Set(parsed.map((p) => p.key));
  for (const p of parsed)
    if (p.diagnostics.length === 0)
      p.diagnostics = [...filterDiagnostics(p), ...callDiagnostics(p, present)];
  // RU-4: a caller of a callee with its own Diagnostics, one level only (#12 addendum A).
  const broken = new Set(
    parsed.filter((p) => p.diagnostics.length > 0).map((p) => p.key),
  );
  for (const p of parsed)
    if (p.diagnostics.length === 0)
      p.diagnostics = brokenCalleeDiagnostics(p, broken);
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
    // A required check's key, `check › <name>`, has two segments too; no file is named check.
    .filter((parts) => parts.length === 2 && parts[0] !== "check");
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
  const files = new Map(parsed.map((p) => [p.key, p]));
  const verdicts: Verdict[] = [];
  const producers: Producer[] = [];
  for (const { key, bytes, ...file } of parsed) {
    // A file GitHub would reject gets no Verdicts; a callee's jobs appear under its callers.
    if (file.diagnostics.length > 0 || calleeOnly(file)) continue;
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
            ...called(
              policy(
                awaiting(trigger(file, event, repo.defaultBranch!), event),
                scenario,
              ),
              file,
              files,
            ),
          };
    const jobs = jobVerdicts(`${key} › `, file, workflow, scenario);
    for (const job of file.jobs)
      producers.push({
        name: checkName(job),
        job: jobs.find((v) => v.key === `${key} › ${job.id.value}`)!,
        workflow,
      });
    verdicts.push(
      workflow,
      ...jobs,
      ...accessVerdicts(`${key} › `, file, scenario),
    );
    // A local callee's jobs, one level deep, under the caller job that ran them (#6).
    for (const { job, path } of calls(file)) {
      const callee =
        path === undefined ? undefined : files.get(calleeKey(path)!);
      if (!callee) continue;
      const prefix = `${key} › ${job.id.value}/`;
      const caller = jobs.find((v) => v.key === `${key} › ${job.id.value}`)!;
      verdicts.push(
        ...jobVerdicts(prefix, callee, caller, scenario, inputsOf(job, callee)),
        ...accessVerdicts(prefix, callee, scenario, { parsed: file, job }),
      );
    }
  }
  verdicts.push(...checkVerdicts(producers, scenario));
  return verdicts;
}

/**
 * A run GitHub would create fails on a secret contract error (root RU-2). One with a remote
 * call is assumed to be accepted, as an unseen RU-2 would fail it (WN-2, #8 §10).
 */
function called(
  verdict: Omit<Verdict, "key">,
  file: ParsedWorkflow,
  files: Map<string, ParsedWorkflow>,
): Omit<Verdict, "key"> {
  if (verdict.value !== "runs") return verdict;
  const contract = contractError(file, files);
  if (contract)
    return {
      value: "fails",
      causes: [
        { rule: "RU-2", spans: [contract], inputs: [] },
        ...verdict.causes,
      ],
    };
  const remote = calls(file).filter((c) => c.path === undefined);
  return {
    ...verdict,
    causes: [
      ...verdict.causes,
      ...remote.map((c) => ({ rule: "WN-2", spans: [c.span], inputs: [] })),
    ],
  };
}

/**
 * A fork contributor's `pull_request` awaiting approval: a run GitHub would create is
 * `pending` (root FK-4, then PL-5), so its jobs are `no-run` (#8 §2).
 */
function awaiting(
  verdict: Omit<Verdict, "key">,
  event: Scenario["event"],
): Omit<Verdict, "key"> {
  // FK-6: pull_request_target runs regardless of approval.
  if (
    event.actor !== "fork" ||
    event.approval !== "awaiting" ||
    event.name === "pull_request_target"
  )
    return verdict;
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

// PRT-3: the day GitHub starts enforcing its default pull_request_target policy.
const ENFORCED = "2026-12-02";

/**
 * The PRT decision table (#6), on a `pull_request_target` run the trigger rules create:
 * GitHub's default policy fails it in an older public repo with no event policy (PRT-2/3),
 * and a newer repo's case is undocumented (PRT-4), settled by the event policy (#8 §4).
 */
function policy(
  verdict: Omit<Verdict, "key">,
  { event, repo }: Scenario,
): Omit<Verdict, "key"> {
  if (event.name !== "pull_request_target") return verdict;
  if (verdict.value !== "runs" && !verdict.possible?.includes("runs"))
    return verdict;
  const input = (path: string, value: unknown) => ({ path, value });
  const visibility = input("repo.visibility", repo.visibility);
  const date = input("repo.date", repo.date);
  const ran = event.actor === "fork" ? [cause("FK-6")] : [];
  const runs = (rule: string, ...inputs: Cause["inputs"]) => ({
    ...verdict,
    causes: [...verdict.causes, ...ran, cause(rule, inputs)],
  });
  if (repo.visibility !== "public") return runs("PRT-2", visibility);
  if (repo.date < ENFORCED) return runs("PRT-3", date);
  const policyInput = input("repo.eventPolicy", repo.eventPolicy);
  if (repo.eventPolicy === "allows") return runs("PRT-1", policyInput);
  // A blocked run fails with a policy error; its check conclusion is undocumented (PRT-5).
  const failed = (...root: Cause[]): Omit<Verdict, "key"> => {
    const causes = [
      ...root,
      cause("PRT-5"),
      cause("PL-10"),
      ...verdict.causes,
      ...ran,
    ];
    return verdict.value === "runs"
      ? { value: "fails", causes }
      : {
          ...verdict,
          causes,
          possible: verdict.possible!.map((p) => (p === "runs" ? "fails" : p)),
        };
  };
  if (repo.eventPolicy === "blocks")
    return failed(cause("PRT-1", [policyInput]));
  if (repo.predates)
    return failed(
      cause("PRT-2", [visibility, policyInput]),
      cause("PRT-3", [date]),
    );
  return {
    value: "uncertain",
    causes: [
      cause("PRT-4", [input("repo.predates", false), policyInput, date]),
      ...verdict.causes,
      ...ran,
    ],
    possible: [...new Set([...(verdict.possible ?? ["runs"]), "fails"])].sort(),
    settle: ["repo.eventPolicy"],
    hints: [
      {
        path: "repo.eventPolicy",
        text: "the `pull_request_target` event policy Repo fact",
        candidates: ["allows", "blocks"],
      },
    ],
  };
}

const cause = (rule: string, inputs: Cause["inputs"] = []): Cause => ({
  rule,
  spans: [],
  inputs,
});

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
