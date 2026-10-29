import { accessVerdicts } from "./access";
import {
  checkVerdicts,
  isCheck,
  nameOf,
  unreadable,
  type Producer,
} from "./checks";
import { jobVerdicts } from "./jobs";
import { namesOf } from "./names";
import {
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
export { isCheck } from "./checks";
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

/** Whether a Verdict key is a job's `<file> › <jobId>`; `check › <name>` has two segments too. */
export const isJobKey = (key: string): boolean =>
  key.split(" › ").length === 2 && !isCheck(key);

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

export interface ProducedChecks {
  /** Every check name the Workflow set's jobs report (RQ-0, RQ-9), once, in file and job order. */
  names: string[];
  /** The names it can't know, by kind (#9 §4). */
  left: {
    /** Matrix jobs: only a derived prefix (RQ-9). */
    matrix: number;
    /** Remote reusable callers: their callees' checks (WN-6). */
    remote: number;
    /** Jobs whose `name:` is an expression (WN-4). */
    expression: number;
  };
}

/**
 * "Require every produced check" (#9 §4): the check names every job of every GitHub workflow
 * produces, whatever the Event, each `name:` evaluated against the Scenario.
 */
export function producedChecks(
  files: WorkflowFile[],
  input: Scenario,
): ProducedChecks {
  const { scenario } = withDefaults(input);
  const parsed = new Map(
    files.flatMap((file) => {
      const key = loaded.exec(file.path)?.[1];
      return key === undefined
        ? []
        : [[key, parseWorkflowFile(file.path, file.text)] as const];
    }),
  );
  const names = new Set<string>();
  const left = { matrix: 0, remote: 0, expression: 0 };
  for (const file of parsed.values()) {
    if (calleeOnly(file)) continue;
    for (const { name, via } of namesOf(file, parsed, (job) =>
      nameOf(job, scenario),
    ))
      if (via === "remote" || via === "matrix") left[via]++;
      else if (name === undefined) left.expression++;
      else names.add(name);
  }
  return { names: [...names], left };
}

// An Assumption names a job key ("fails") or one of its outputs (`<job key> › outputs.<name>`).
function unmatched(
  scenario: Scenario,
  verdicts: Verdict[],
): UnmatchedAssumption[] {
  const jobs = verdicts
    .filter((v) => isJobKey(v.key))
    .map((v) => v.key.split(" › "));
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
  // With the merge queue on, a pull request's merge group runs a synthesised merge_group
  // Event, sharing the main Event's entries (#6, #8 §5).
  const queue: Scenario | undefined =
    repo.mergeQueue && event.name !== "push"
      ? {
          ...scenario,
          event: { ...event, name: "merge_group", type: "checks_requested" },
        }
      : undefined;
  const queued: Producer[] = [];
  // A same-repo or Dependabot PR's head branch is pushed too, and that run reports on the
  // head SHA, reusing the PR's changed files (PA-4, #6).
  const pushed: Scenario | undefined =
    event.name !== "push" && event.actor !== "fork"
      ? { ...scenario, event: { ...event, name: "push" } }
      : undefined;
  const pa4: Cause = {
    rule: "PA-4",
    spans: [],
    inputs: [{ path: "event.changed", value: event.changed }],
  };
  for (const { key, bytes, ...file } of parsed) {
    if (file.diagnostics.length > 0 && !calleeOnly(file)) {
      const unread = unreadable(key, file, scenario);
      producers.push(...unread);
      queued.push(...unread);
    }
    // A file GitHub would reject gets no Verdicts; a callee's jobs appear under its callers.
    if (file.diagnostics.length > 0 || calleeOnly(file)) continue;
    // PL-9: GitHub starts no runs from it, but it isn't a Diagnostic, so its keys stay (ADR 0001).
    // A merge group has no fork or pull_request_target policy to apply.
    const run = (s: Scenario, merging = false): Verdict => {
      if (bytes > MAX_BYTES)
        return {
          key,
          value: "skipped",
          causes: [{ rule: "PL-9", spans: [], inputs: [] }],
        };
      const triggered = trigger(file, s.event, repo.defaultBranch!);
      return {
        key,
        ...called(
          merging ? triggered : policy(awaiting(triggered, s.event), s),
          file,
          files,
        ),
      };
    };
    const workflow = run(scenario);
    // The local callees, one level deep, each with the caller job that runs it (#6).
    const callees = calls(file).flatMap(({ job, path }) => {
      const callee =
        path === undefined ? undefined : files.get(calleeKey(path)!);
      return callee ? [{ job, callee }] : [];
    });
    // The file's jobs, then each local callee's under the caller job that ran them.
    const jobsWithCallees = (workflow: Verdict, scenario: Scenario) => {
      const jobs = jobVerdicts(`${key} › `, file, workflow, scenario);
      for (const { job, callee } of callees) {
        const caller = jobs.find((v) => v.key === `${key} › ${job.id.value}`)!;
        jobs.push(
          ...jobVerdicts(
            `${key} › ${job.id.value}/`,
            callee,
            caller,
            scenario,
            inputsOf(job, callee),
          ),
        );
      }
      return jobs;
    };
    const producing = (
      s: Scenario,
      jobs: Verdict[],
      workflow: Verdict,
      note: Cause[] = [],
    ): Producer[] =>
      // Each `name:`, a caller's too, is evaluated against the Scenario (WN-4).
      namesOf(file, files, (job) => nameOf(job, s)).map((named) => {
        const v = jobs.find((v) => v.key === `${key} › ${named.id}`)!;
        return {
          ...named,
          job: { ...v, causes: [...note, ...v.causes] },
          workflow,
          spans: file.jobSpans.get(named.id),
        };
      });
    const jobs = jobsWithCallees(workflow, scenario);
    producers.push(...producing(scenario, jobs, workflow));
    if (pushed) {
      const w = run(pushed);
      producers.push(
        ...producing(pushed, jobsWithCallees(w, pushed), w, [pa4]),
      );
    }
    if (queue) {
      const w = run(queue, true);
      queued.push(...producing(queue, jobsWithCallees(w, queue), w));
    }
    verdicts.push(
      workflow,
      ...jobs,
      ...accessVerdicts(`${key} › `, file, scenario),
      ...callees.flatMap(({ job, callee }) =>
        accessVerdicts(`${key} › ${job.id.value}/`, callee, scenario, {
          parsed: file,
          job,
        }),
      ),
    );
  }
  verdicts.push(...checkVerdicts(producers, scenario, queue && queued));
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
