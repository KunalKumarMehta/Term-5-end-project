import {
  accessSync,
  appendFileSync,
  constants,
  globSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  type Dirent,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { LineCounter, isMap, isScalar, parseDocument } from "yaml";
import {
  PLATFORM_BASELINE,
  blocksUpdate,
  compareTest,
  findingText,
  isAccess,
  isCheck,
  isConcurrency,
  parseTestFile,
  shown,
  simulate,
  updateTestFile,
  withCandidates,
  validateScenario,
  type ActorKind,
  type Change,
  type Diagnostic,
  type Finding,
  type Scenario,
  type SimulationResult,
  type Test,
  type TestFile,
  type WorkflowFile,
} from "../core";

const ACTORS = ["member", "fork", "dependabot"];
const TESTS = ".github/whynorun/**/*.test.yml";

const USAGE = `usage: whynorun show --event <name> --date <YYYY-MM-DD> [--ref <ref>] [--base <branch>]
                     [--actor member|fork|dependabot] [--changed <file>|-] [--repo <dir>]
                     [--flow access|all]
       whynorun show --from <test file> [--scenario <label>] [--repo <dir>]
                     [--flow access|checks|concurrency|all]
       whynorun test [--json] [--update] [patterns…]
       whynorun --version
`;

/** `stdin` reads standard input, for `--changed -`. */
export function main(
  argv: string[],
  stdin: () => string = () => readFileSync(0, "utf8"),
): number {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`whynorun ${__VERSION__}\n`);
    return 0;
  }
  if (argv[0] === "show") return show(argv.slice(1), stdin);
  if (argv[0] === "test") return runTests(argv.slice(1));
  return misuse();
}

function misuse(message?: string): number {
  process.stderr.write(message ? `whynorun: ${message}\n${USAGE}` : USAGE);
  return 2;
}

/** Unusable input that isn't misuse: exit 2 with the messages, one per line. */
function unusable(messages: string[]): number {
  process.stderr.write(messages.map((m) => `${m}\n`).join(""));
  return 2;
}

// Only the folder's own files: GitHub ignores subfolders. Never git, never the network.
function readWorkflows(repo: string): WorkflowFile[] | undefined {
  const dir = join(resolve(repo), ".github", "workflows");
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  return entries
    .filter((e) => e.isFile())
    .map((e) => ({
      path: `.github/workflows/${e.name}`,
      text: readFileSync(join(dir, e.name), "utf8"),
    }));
}

/** A Test file parsed, with the text it was read from. */
function readTestFile(
  path: string,
): ReturnType<typeof parseTestFile> & { text?: string } {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    return {
      errors: [
        `${path}: can't read it (${(err as NodeJS.ErrnoException).code})`,
      ],
    };
  }
  return { text, ...parseTestFile(path, text) };
}

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** `whynorun test [patterns…]`: every pattern a glob from the cwd (#10 §4–7, #13 §4). */
function runTests(args: string[]): number {
  let positionals, json, update;
  try {
    ({
      positionals,
      values: { json, update },
    } = parseArgs({
      args,
      allowPositionals: true,
      options: { json: { type: "boolean" }, update: { type: "boolean" } },
    }));
  } catch (err) {
    return misuse((err as Error).message);
  }
  const paths = new Set<string>();
  for (const pattern of positionals.length > 0 ? positionals : [TESTS]) {
    const matches = globSync(pattern);
    if (matches.length === 0) {
      // A misnamed file must not pass silently (#10 §4).
      const nearby = [
        ...new Set(
          globSync([
            pattern.replace(/\.yml$/, ".yaml"),
            TESTS.replace(/\.yml$/, ".yaml"),
          ]),
        ),
      ].sort(byCodeUnit);
      return unusable([
        `whynorun: no Test files match ${pattern}` +
          (nearby.length > 0
            ? `; Test files end in .test.yml, so these don't count: ${nearby.join(", ")}`
            : ""),
      ]);
    }
    for (const match of matches) paths.add(match);
  }

  const files: { path: string; text: string; file: TestFile }[] = [];
  const errors: string[] = [];
  for (const path of [...paths].sort(byCodeUnit)) {
    const read = readTestFile(path);
    if (read.errors) errors.push(...read.errors);
    else files.push({ path, text: read.text!, file: read.file });
  }
  if (errors.length > 0) return unusable(errors);
  const workflows = readWorkflows(".");
  if (!workflows)
    return unusable([
      `whynorun: no .github/workflows/ folder in ${resolve(".")}`,
    ]);

  // Diagnostics never depend on the Scenario: listed once, and any of them fails the run.
  let diagnostics: Diagnostic[] = [];
  const runs: TestRun[] = files.flatMap(({ path, text, file }) =>
    file.tests.map((test, index) => {
      const result = simulate(workflows, test.scenario);
      if (diagnostics.length === 0) diagnostics = result.diagnostics;
      const findings = compareTest(test, result);
      const failed = findings.filter((f) => f.status !== "match");
      const note =
        failed.length > 0 && test.scenario.event.name === "pull_request_target"
          ? DB4
          : undefined;
      return { path, text, index, test, result, findings, failed, note };
    }),
  );
  const failing = runs.filter((r) => r.failed.length > 0);
  let code = diagnostics.length > 0 || failing.length > 0 ? 1 : 0;

  // `--update` (#10 §6): all or nothing, so anything that blocks it anywhere writes nothing.
  let updated: string[] | undefined;
  if (
    update &&
    code === 1 &&
    diagnostics.length === 0 &&
    !failing.some((r) => r.failed.some(blocksUpdate))
  ) {
    const writes = files.flatMap(({ path, text, file }) => {
      const next = updateTestFile(
        text,
        file,
        runs.filter((r) => r.path === path).map((r) => r.result),
      );
      return next === undefined ? [] : [{ path, text: next }];
    });
    const failed = writeAll(writes);
    if (failed) return unusable([failed]);
    updated = writes.map((w) => w.path);
    code = 0;
  }

  if (process.env.GITHUB_ACTIONS === "true" && code === 1) {
    for (const d of diagnostics) annotate(d.path, d.line, d.message);
    for (const r of failing)
      for (const f of r.failed) {
        const at = where(r, f);
        if (at)
          annotate(
            ...at,
            `${r.test.label} (${r.path}): ${findingText(f)}${r.note ? `; ${r.note}` : ""}`,
          );
      }
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, summaryTable(diagnostics, failing));
  }

  if (json) {
    // Covered by semver (#10 §7): `format` changes only with a new document shape.
    const doc = {
      format: 1,
      version: __VERSION__,
      diagnostics,
      tests: runs.map((r) => ({
        file: r.path,
        label: r.test.label,
        findings: r.findings,
        note: r.note,
      })),
    };
    process.stdout.write(
      `${JSON.stringify(doc, (_, v: unknown) => v ?? null, 2)}\n`,
    );
    return code;
  }
  const blocks = [
    ...(diagnostics.length > 0
      ? [diagnostics.map((d) => `${d.path}:${d.line}: ${d.message}`)]
      : []),
    ...failing.map((r) => [
      `${r.path}: ${r.test.label}`,
      ...r.failed.map(findingText),
      ...(r.note ? [`note: ${r.note}`] : []),
    ]),
    ...(updated
      ? [updated.map((path) => `updated ${path}`)]
      : update && code === 1
        ? [["whynorun: --update wrote nothing: fix what blocks it above first"]]
        : []),
  ];
  process.stdout.write(
    [
      `whynorun ${__VERSION__}`,
      ...blocks.map((b) => `\n${b.join("\n")}`),
      "",
    ].join("\n"),
  );
  return code;
}

const DB4 = "this Verdict describes behaviour after merge (DB-4)";

/**
 * Writes every file or none (#10 §6): each target must be writable, each new text goes to a
 * temporary file beside it, and only then are they all renamed over their targets.
 * Returns the error, if any.
 */
function writeAll(
  writes: { path: string; text: string }[],
): string | undefined {
  const temps: string[] = [];
  let at = "";
  try {
    for (const { path } of writes) accessSync((at = path), constants.W_OK);
    for (const { path, text } of writes) {
      at = path;
      temps.push(`${path}.whynorun-${process.pid}`);
      writeFileSync(temps.at(-1)!, text, { flag: "wx" });
    }
  } catch (err) {
    for (const temp of temps) rmSync(temp, { force: true });
    return `${at}: can't write it (${(err as NodeJS.ErrnoException).code})`;
  }
  writes.forEach(({ path }, i) => renameSync(temps[i]!, path));
  return undefined;
}

interface TestRun {
  path: string;
  /** The Test file's text, as parsed. */
  text: string;
  index: number;
  test: Test;
  result: SimulationResult;
  findings: Finding[];
  failed: Finding[];
  note: string | undefined;
}

// GitHub's workflow-command escaping: properties also escape : and ,.
const escapeData = (s: string) =>
  s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
const escapeProperty = (s: string) =>
  escapeData(s).replaceAll(":", "%3A").replaceAll(",", "%2C");

/** An `::error` annotation on stderr, which leaves stdout to `--json`. */
function annotate(file: string, line: number, message: string): void {
  process.stderr.write(
    `::error file=${escapeProperty(file)},line=${line}::${escapeData(message)}\n`,
  );
}

/**
 * Where a failing pin is annotated (#10 §7): the YAML line of its new root cause, or else
 * the line in the Test file that it comes from. A file's Diagnostics carry their own lines.
 */
function where(r: TestRun, f: Finding): [string, number] | undefined {
  if (f.status === "file has Diagnostics") return undefined;
  const key = f.status === "Scenario unsupported" ? "event" : f.key;
  const span = r.result.verdicts.find((v) => v.key === key)?.causes[0]
    ?.spans[0];
  if (span) return [span.path, span.line];
  const map =
    f.status === "assumed subject not found"
      ? ["scenario", "assume"]
      : f.status === "Scenario unsupported"
        ? ["scenario"]
        : ["pins"];
  return [r.path, keyLine(r.text, ["tests", r.index, ...map], key)];
}

/** The line of `key` in the Test file text's map at `path`, or of the map when the key isn't there. */
function keyLine(text: string, path: unknown[], key: string): number {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter });
  const map = doc.getIn(path, true);
  const pair = isMap(map)
    ? map.items.find((p) => isScalar(p.key) && String(p.key.value) === key)
    : undefined;
  const range = isScalar(pair?.key)
    ? pair.key.range
    : (map as { range?: number[] } | undefined)?.range;
  return lineCounter.linePos(range?.[0] ?? 0).line;
}

const cell = (s: string) => s.replaceAll("|", "\\|").replace(/\r?\n/g, " ");

/** Subject, Pinned and Now cells for one finding. */
function diffCells(f: Finding): string[] {
  switch (f.status) {
    case "match":
      return [f.key, "—", "matches"];
    case "changed": {
      const side = (pick: (c: Change) => unknown) =>
        f.changes
          .map((c) =>
            c.field === "value"
              ? shown(pick(c))
              : `${c.field} ${shown(pick(c))}`,
          )
          .join("; ");
      return [f.key, side((c) => c.pinned), side((c) => c.now)];
    }
    case "pinned subject not found":
    case "assumed subject not found":
      return [f.key, "—", f.status + withCandidates(f.candidates)];
    case "file has Diagnostics":
      return [f.file, "—", f.status];
    case "Scenario unsupported":
      return ["event", "—", findingText(f)];
  }
}

/** The Markdown diff table for `$GITHUB_STEP_SUMMARY`, then any DB-4 notes. */
function summaryTable(diagnostics: Diagnostic[], failing: TestRun[]): string {
  const rows = [
    ...diagnostics.map((d) => ["—", `${d.path}:${d.line}`, "—", d.message]),
    ...failing.flatMap((r) =>
      r.failed.map((f) => [`${r.path}: ${r.test.label}`, ...diffCells(f)]),
    ),
  ];
  const notes = failing.flatMap((r) =>
    r.note ? [`- ${r.path}: ${r.test.label}: ${r.note}`] : [],
  );
  return [
    `### whynorun ${__VERSION__}`,
    "",
    "| Test | Subject | Pinned | Now |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
    ...(notes.length > 0 ? ["", ...notes] : []),
    "",
  ].join("\n");
}

// Flags that describe a Scenario, which `--from` can't be combined with (#10 §6).
const SCENARIO_FLAGS = [
  "event",
  "date",
  "ref",
  "base",
  "actor",
  "changed",
] as const;
const FLOWS: Record<string, (key: string) => boolean> = {
  access: isAccess,
  checks: isCheck,
  concurrency: isConcurrency,
  all: () => true,
};

function show(args: string[], stdin: () => string): number {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: {
        event: { type: "string" },
        date: { type: "string" },
        ref: { type: "string" },
        base: { type: "string" },
        actor: { type: "string" },
        changed: { type: "string" },
        from: { type: "string" },
        scenario: { type: "string" },
        repo: { type: "string", default: "." },
        flow: { type: "string", default: "all" },
      },
    }));
  } catch (err) {
    return misuse((err as Error).message);
  }
  const { from, repo, flow } = values;
  if (!Object.hasOwn(FLOWS, flow))
    return misuse("--flow must be access, checks, concurrency or all");
  let scenario: Scenario;
  if (from !== undefined) {
    const flag = SCENARIO_FLAGS.find((f) => values[f] !== undefined);
    if (flag) return misuse(`--from can't be combined with --${flag}`);
    const read = readTestFile(from);
    if (read.errors) return unusable(read.errors);
    const { tests } = read.file;
    const labels = tests.map((t) => t.label).join(", ");
    const label = values.scenario;
    if (label === undefined && tests.length > 1)
      return misuse(
        `${from} has ${tests.length} tests: choose one with --scenario <label> (${labels})`,
      );
    const test =
      label === undefined ? tests[0] : tests.find((t) => t.label === label);
    if (!test)
      return misuse(`no test labelled ${label} in ${from} (${labels})`);
    scenario = test.scenario;
  } else {
    if (values.scenario !== undefined)
      return misuse("--scenario picks a test from --from <test file>");
    if (flow === "checks" || flow === "concurrency")
      return misuse(
        `--flow ${flow} needs required checks or a Follow-up event, which flags can't describe: use --from <test file>`,
      );
    const flags = fromFlags(values, stdin);
    if (typeof flags === "number") return flags;
    scenario = flags;
  }

  const files = readWorkflows(repo);
  if (!files) return misuse(`no .github/workflows/ folder in ${resolve(repo)}`);

  const { verdicts, diagnostics } = simulate(files, scenario);
  // The flow's keys, plus an Unsupported Event's own line.
  const shown = verdicts.filter(
    (v) => v.key === "event" || FLOWS[flow]!(v.key),
  );
  // A broken file's Diagnostics print where its Verdicts would, in subject-key order.
  const lines = [
    ...shown.map((v) => {
      const root = v.causes[0];
      const line = root?.spans[0]?.line;
      // The assumed defaults that decide it, after the root (#8 §3).
      const assumed = v.causes
        .filter((c) => c.rule === "WN-5")
        .flatMap((c) => c.inputs)
        .map(({ path, value }) => `; WN-5 assumed ${path} = ${String(value)}`)
        .join("");
      return [
        v.key,
        `${v.key}: ${v.value} (root ${root?.rule}${line ? `, line ${line}` : ""}${assumed})`,
      ];
    }),
    ...diagnostics.map((d) => [
      d.path.slice(d.path.lastIndexOf("/") + 1),
      `${d.path}:${d.line}: ${d.message}`,
    ]),
  ]
    .sort(([a], [b]) => byCodeUnit(a!, b!))
    .map(([, text]) => text);
  process.stdout.write(
    [
      `whynorun ${__VERSION__}`,
      "",
      "What WhyNoRun always assumes:",
      ...PLATFORM_BASELINE.map((item) => `- ${item}`),
      "",
      ...lines,
      "",
    ].join("\n"),
  );
  return 0;
}

/** A flow-1 Scenario from `show`'s flags, or the misuse exit code. */
function fromFlags(
  values: Partial<Record<(typeof SCENARIO_FLAGS)[number], string>>,
  stdin: () => string,
): Scenario | number {
  const { event, date, ref, base, actor, changed } = values;
  if (event === undefined) return misuse("show needs --event <name>");
  if (date === undefined)
    return misuse("show needs --date <YYYY-MM-DD>, the simulation date");

  if (actor !== undefined && !ACTORS.includes(actor))
    return misuse("--actor must be member, fork or dependabot");

  // The activity type has no flag: it is always GitHub's defaults (#10 §6).
  const scenario: Scenario = { event: { name: event }, repo: { date } };
  if (ref !== undefined) scenario.event.ref = ref;
  if (base !== undefined) scenario.event.base = base;
  if (actor !== undefined) scenario.event.actor = actor as ActorKind;
  // The complete diff, one path per line; unset, it is empty (#10 §6). Never from git.
  if (changed !== undefined) {
    let text: string;
    try {
      text = changed === "-" ? stdin() : readFileSync(changed, "utf8");
    } catch {
      return misuse(`can't read --changed ${changed}`);
    }
    scenario.event.changed = text.split(/\r?\n/).filter((line) => line !== "");
  }
  // No head commit message flag: a commit-message skip needs --from (#10 §6).
  if (validateScenario(scenario).length > 0)
    return misuse(`--event or --date is invalid: --date must be YYYY-MM-DD`);
  return scenario;
}
