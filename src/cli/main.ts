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
                     [--actor member|fork|dependabot] [--repo <dir>] [--flow access|all]
       whynorun --version
`;

export function main(argv: string[]): number {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`whynorun ${__VERSION__}\n`);
    return 0;
  }
  if (argv[0] === "show") return show(argv.slice(1));
  return misuse();
}

function misuse(message?: string): number {
  process.stderr.write(message ? `whynorun: ${message}\n${USAGE}` : USAGE);
  return 2;
}

function show(args: string[]): number {
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
        repo: { type: "string", default: "." },
        flow: { type: "string", default: "all" },
      },
    }));
  } catch (err) {
    return misuse((err as Error).message);
  }
  const { event, date, ref, base, actor, repo, flow } = values;
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

  const lines = simulate(files, scenario).verdicts.map((v) => {
    const root = v.causes[0];
    const line = root?.spans[0]?.line;
    return `${v.key}: ${v.value} (root ${root?.rule}${line ? `, line ${line}` : ""})`;
  });
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
