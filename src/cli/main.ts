import { globSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  PLATFORM_BASELINE,
  compareTest,
  findingText,
  isAccess,
  isCheck,
  isConcurrency,
  parseTestFile,
  simulate,
  validateScenario,
  type ActorKind,
  type Scenario,
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
       whynorun test [patterns…]
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

function readTestFile(path: string): ReturnType<typeof parseTestFile> {
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
  return parseTestFile(path, text);
}

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** `whynorun test [patterns…]`: every pattern a glob from the cwd (#10 §4–7, #13 §4). */
function runTests(args: string[]): number {
  let positionals;
  try {
    ({ positionals } = parseArgs({ args, allowPositionals: true }));
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

  const files: { path: string; file: TestFile }[] = [];
  const errors: string[] = [];
  for (const path of [...paths].sort(byCodeUnit)) {
    const read = readTestFile(path);
    if (read.errors) errors.push(...read.errors);
    else files.push({ path, file: read.file });
  }
  if (errors.length > 0) return unusable(errors);
  const workflows = readWorkflows(".");
  if (!workflows)
    return unusable([
      `whynorun: no .github/workflows/ folder in ${resolve(".")}`,
    ]);

  const blocks: string[][] = [];
  let diagnosed = false;
  for (const { path, file } of files)
    for (const test of file.tests) {
      const result = simulate(workflows, test.scenario);
      // Diagnostics never depend on the Scenario: listed once, and any of them fails the run.
      if (!diagnosed && result.diagnostics.length > 0)
        blocks.push(
          result.diagnostics.map((d) => `${d.path}:${d.line}: ${d.message}`),
        );
      diagnosed ||= result.diagnostics.length > 0;
      const lines = compareTest(test, result)
        .filter((f) => f.status !== "match")
        .map(findingText);
      if (lines.length > 0) blocks.push([`${path}: ${test.label}`, ...lines]);
    }
  process.stdout.write(
    [
      `whynorun ${__VERSION__}`,
      ...blocks.map((b) => `\n${b.join("\n")}`),
      "",
    ].join("\n"),
  );
  return blocks.length > 0 ? 1 : 0;
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
