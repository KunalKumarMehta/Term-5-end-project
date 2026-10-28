import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  PLATFORM_BASELINE,
  simulate,
  validateScenario,
  type ActorKind,
  type Scenario,
} from "../core";

const ACTORS = ["member", "fork", "dependabot"];

const USAGE = `usage: whynorun show --event <name> --date <YYYY-MM-DD> [--ref <ref>] [--base <branch>]
                     [--actor member|fork|dependabot] [--changed <file>|-] [--repo <dir>]
                     [--flow access|all]
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
  return misuse();
}

function misuse(message?: string): number {
  process.stderr.write(message ? `whynorun: ${message}\n${USAGE}` : USAGE);
  return 2;
}

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
        repo: { type: "string", default: "." },
        flow: { type: "string", default: "all" },
      },
    }));
  } catch (err) {
    return misuse((err as Error).message);
  }
  const { event, date, ref, base, actor, changed, repo, flow } = values;
  if (flow === "checks" || flow === "concurrency")
    return misuse(
      `--flow ${flow} needs required checks or a Follow-up event, which flags can't describe: use --from <test file>`,
    );
  if (flow !== "access" && flow !== "all")
    return misuse("--flow must be access, checks, concurrency or all");
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

  // Only the folder's own files: GitHub ignores subfolders. Never git, never the network.
  const dir = join(resolve(repo), ".github", "workflows");
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return misuse(`no .github/workflows/ folder in ${resolve(repo)}`);
  }
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => ({
      path: `.github/workflows/${e.name}`,
      text: readFileSync(join(dir, e.name), "utf8"),
    }));

  const { verdicts, diagnostics } = simulate(files, scenario);
  // `--flow access`: the token scope and secrets keys, plus an Unsupported Event's own line.
  const shown =
    flow === "access"
      ? verdicts.filter(
          (v) =>
            v.key === "event" || / › (token\.[a-z-]+|secrets)$/.test(v.key),
        )
      : verdicts;
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
    .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0))
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
