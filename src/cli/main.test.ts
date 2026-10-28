import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test, vi } from "vitest";
import { PLATFORM_BASELINE } from "../core";
import { main } from "./main";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const fixture = fileURLToPath(new URL("fixtures/repo", import.meta.url));
const cwd = process.cwd();

afterEach(() => {
  vi.restoreAllMocks();
  process.chdir(cwd);
});

function run(...argv: string[]) {
  const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const code = main(argv);
  const text = (spy: typeof stdout) => spy.mock.calls.map((c) => c[0]).join("");
  return { code, stdout: text(stdout), stderr: text(stderr) };
}

// Access key lines (#62), left out by tests not about access.
const withoutAccess = (stdout: string) =>
  stdout.replace(/^.* › (?:token\.[a-z-]+|secrets): .*\n/gm, "");
const runsOnly = (result: ReturnType<typeof run>) => ({
  ...result,
  stdout: withoutAccess(result.stdout),
});

const showOutput = [
  `whynorun ${version}`,
  "",
  "What WhyNoRun always assumes:",
  ...PLATFORM_BASELINE.map((line) => `- ${line}`),
  "",
  "ci.yml: runs (root EV-0, line 3)",
  "ci.yml › release: skipped (root JG-3, line 12)",
  "ci.yml › test: runs (root WN-2, line 6)",
  "docs.yml: skipped (root EV-0, line 2)",
  "docs.yml › build: no-run (root EV-0, line 2)",
  "",
].join("\n");

test("--version prints whynorun <version> and exits 0", () => {
  expect(run("--version")).toEqual({
    code: 0,
    stdout: `whynorun ${version}\n`,
    stderr: "",
  });
});

test("an unknown command is misuse: exits 2 with usage on stderr", () => {
  const { code, stdout, stderr } = run("frobnicate");
  expect(code).toBe(2);
  expect(stdout).toBe("");
  expect(stderr).toMatch(/^usage: whynorun show --event/);
});

test("show in a fixture repo prints the version, the Platform baseline and one line per GitHub workflow and per job", () => {
  process.chdir(fixture);
  expect(
    runsOnly(run("show", "--event", "push", "--date", "2026-12-03")),
  ).toEqual({
    code: 0,
    stdout: showOutput,
    stderr: "",
  });
});

test("show --repo <dir> reads another folder's .github/workflows/", () => {
  expect(
    runsOnly(
      run("show", "--repo", fixture, "--event", "push", "--date", "2026-12-03"),
    ),
  ).toEqual({ code: 0, stdout: showOutput, stderr: "" });
});

test("show --flow all prints every Verdict: the runs, and each job's access keys after it", () => {
  const all = run(
    "show",
    "--repo",
    fixture,
    "--event",
    "push",
    "--date",
    "2026-12-03",
    "--flow",
    "all",
  );
  expect(runsOnly(all)).toEqual({ code: 0, stdout: showOutput, stderr: "" });
  // No permissions: anywhere, so the restricted token default decides (PERM-1).
  expect(all.stdout).toContain(
    "ci.yml › test: runs (root WN-2, line 6)\n" +
      "ci.yml › test › secrets: available (root FK-0)\n" +
      "ci.yml › test › token.actions: none (root PERM-1; WN-5 assumed repo.tokenDefault = restricted)\n",
  );
  expect(all.stdout.match(/ › (token\.[a-z-]+|secrets): /g)).toHaveLength(
    3 * 18,
  );
});

test("show prints each assumed default that decides a Verdict as a WN-5 cause after its root, never as the root", () => {
  const { stdout } = run(
    "show",
    "--repo",
    fixture,
    "--event",
    "push",
    "--date",
    "2026-12-03",
  );
  // The token default decides every token scope of a job with no permissions: block.
  expect(stdout).toContain(
    "ci.yml › test › token.contents: read (root PERM-1; WN-5 assumed repo.tokenDefault = restricted)\n",
  );
  // It doesn't decide secrets or a run Verdict.
  expect(stdout).toContain("ci.yml › test › secrets: available (root FK-0)\n");
  expect(stdout).toContain("ci.yml: runs (root EV-0, line 3)\n");
  expect(stdout).not.toMatch(/root WN-5/);
  expect(stdout.match(/WN-5/g)).toHaveLength(3 * 17);
});

test("show prints a broken file's Diagnostic at file:line in place of its Verdicts, and the other files' Verdicts", () => {
  const broken = fileURLToPath(
    new URL("fixtures/broken-repo", import.meta.url),
  );
  const { code, stdout } = run(
    "show",
    "--repo",
    broken,
    "--event",
    "push",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(0);
  expect(withoutAccess(stdout)).toMatch(
    /\n\n\.github\/workflows\/broken\.yml:3: Unexpected value 'branchez'\nci\.yml: runs \(root EV-0, line 3\)\nci\.yml › test: runs \(root WN-2, line 6\)\ndocs\.yml: skipped \(root EV-0, line 2\)\ndocs\.yml › build: no-run \(root EV-0, line 2\)\n$/,
  );
});

test("show prints an Unsupported Event as one event line, root WN-3", () => {
  const { code, stdout } = run(
    "show",
    "--repo",
    fixture,
    "--event",
    "schedule",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(0);
  expect(stdout).toMatch(/\n\nevent: unsupported \(root WN-3\)\n$/);
});

test("show without --date exits 2 with a message", () => {
  const { code, stdout, stderr } = run(
    "show",
    "--repo",
    fixture,
    "--event",
    "push",
  );
  expect(code).toBe(2);
  expect(stdout).toBe("");
  expect(stderr).toContain("--date");
});

test("show with a --date that isn't YYYY-MM-DD exits 2 with a message", () => {
  const { code, stderr } = run(
    "show",
    "--repo",
    fixture,
    "--event",
    "push",
    "--date",
    "tomorrow",
  );
  expect(code).toBe(2);
  expect(stderr).toContain("--date");
});

test.each(["checks", "concurrency"])(
  "show --flow %s exits 2 and points at --from",
  (flow) => {
    const { code, stderr } = run(
      "show",
      "--repo",
      fixture,
      "--event",
      "push",
      "--date",
      "2026-12-03",
      "--flow",
      flow,
    );
    expect(code).toBe(2);
    expect(stderr).toContain("--from");
  },
);

const filters = fileURLToPath(new URL("fixtures/filters", import.meta.url));
// Everything after the last blank line.
const lastBlock = (stdout: string) =>
  stdout.slice(stdout.lastIndexOf("\n\n", stdout.length - 2) + 2);
// The GitHub workflow and job lines, for tests not about access.
const verdictLines = (stdout: string) => lastBlock(withoutAccess(stdout));

test("show --ref with a tag ref skips a GitHub workflow with only a branches: filter, root BR-3 on its line", () => {
  const { code, stdout } = run(
    "show",
    "--repo",
    filters,
    "--event",
    "push",
    "--ref",
    "refs/tags/v1.0.0",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(0);
  expect(verdictLines(stdout)).toBe(
    "release.yml: skipped (root BR-3, line 4)\n" +
      "release.yml › build: no-run (root BR-3, line 4)\n",
  );
});

test.each([
  [
    "main",
    "release.yml: runs (root BR-4, line 6)\nrelease.yml › build: runs (root WN-2, line 8)\n",
  ],
  [
    "dev",
    "release.yml: skipped (root BR-4, line 6)\nrelease.yml › build: no-run (root BR-4, line 6)\n",
  ],
])(
  "show --event pull_request --base %s matches the base branch",
  (base, line) => {
    const { code, stdout } = run(
      "show",
      "--repo",
      filters,
      "--event",
      "pull_request",
      "--ref",
      "feature",
      "--base",
      base,
      "--date",
      "2026-12-03",
    );
    expect(code).toBe(0);
    expect(verdictLines(stdout)).toBe(line);
  },
);

test("show --event pull_request --actor fork on the example set: the Fork PR's Verdicts (snapshot)", () => {
  // The bundled example set (#15 §2), as a repo folder.
  const repo = mkdtempSync(join(tmpdir(), "whynorun-example-"));
  const workflows = join(repo, ".github", "workflows");
  mkdirSync(workflows, { recursive: true });
  for (const name of ["ci.yml", "deploy.yml", "triage.yml"])
    copyFileSync(
      fileURLToPath(
        new URL(`../../playground/src/example/${name}`, import.meta.url),
      ),
      join(workflows, name),
    );
  try {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    // `--changed` names a file listing the diff, so stdin holds src/app.ts.
    const code = main(
      [
        "show",
        "--repo",
        repo,
        "--event",
        "pull_request",
        "--actor",
        "fork",
        "--date",
        "2026-12-03",
        "--changed",
        "-",
      ],
      () => "src/app.ts\n",
    );
    expect(code).toBe(0);
    expect(
      lastBlock(stdout.mock.calls.map((c) => c[0]).join("")),
    ).toMatchSnapshot();
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("show --actor with an unknown Actor kind exits 2 and names the kinds", () => {
  const { code, stdout, stderr } = run(
    "show",
    "--repo",
    filters,
    "--event",
    "push",
    "--actor",
    "admin",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(2);
  expect(stdout).toBe("");
  expect(stderr).toContain("--actor must be member, fork or dependabot");
});

const paths = fileURLToPath(new URL("fixtures/paths", import.meta.url));
const prArgs = ["show", "--repo", paths, "--event", "pull_request"];
const prDate = ["--date", "2026-12-03"];
const runs =
  "ci.yml: runs (root PA-2, line 5)\nci.yml › build: runs (root WN-2, line 7)\n";

test("show --changed - reads the changed files from stdin, one per line", () => {
  const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const code = main(
    [...prArgs, "--changed", "-", ...prDate],
    () => "docs/README.md\r\nsrc/app.ts\n",
  );
  expect(code).toBe(0);
  expect(verdictLines(stdout.mock.calls.map((c) => c[0]).join(""))).toBe(runs);
});

test("show --changed <file> reads the changed files from that file", () => {
  process.chdir(paths);
  const { code, stdout } = run(
    ...prArgs,
    "--changed",
    "changed.txt",
    ...prDate,
  );
  expect(code).toBe(0);
  expect(verdictLines(stdout)).toBe(runs);
});

const access = fileURLToPath(new URL("fixtures/access", import.meta.url));

test("show --flow access prints one line per access key with its root and YAML line, and nothing else", () => {
  const { code, stdout } = run(
    "show",
    "--repo",
    access,
    "--event",
    "push",
    "--date",
    "2026-12-03",
    "--flow",
    "access",
  );
  expect(code).toBe(0);
  const none = (scope: string) =>
    `ci.yml › test › token.${scope}: none (root PERM-3, line 6)`;
  expect(lastBlock(stdout)).toBe(
    [
      "ci.yml › test › secrets: available (root FK-0)",
      ...["actions", "artifact-metadata", "attestations", "checks"].map(none),
      none("code-quality"),
      "ci.yml › test › token.contents: read (root PERM-3, line 7)",
      ...["copilot-requests", "deployments", "discussions"].map(none),
      ...["id-token", "issues", "packages", "pages"].map(none),
      "ci.yml › test › token.pull-requests: write (root PERM-3, line 8)",
      ...["security-events", "statuses", "vulnerability-alerts"].map(none),
      "",
    ].join("\n"),
  );
});

test("show prints a local callee's jobs under their caller, capped by its permissions: (PERM-7), and no lines for the workflow_call-only file", () => {
  const { code, stdout } = run(
    "show",
    "--repo",
    fileURLToPath(new URL("fixtures/reusable", import.meta.url)),
    "--event",
    "push",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(0);
  expect(verdictLines(stdout)).toBe(
    [
      "ci.yml: runs (root EV-0, line 2)",
      "ci.yml › deploy: runs (root WN-2, line 4)",
      "ci.yml › deploy/publish: runs (root WN-2, line 6)",
      "",
    ].join("\n"),
  );
  expect(stdout).toContain(
    "ci.yml › deploy/publish › token.contents: read (root PERM-7, line 5)\n",
  );
  expect(stdout).toContain(
    "ci.yml › deploy/publish › secrets: available (root RU-1, line 7)\n",
  );
  expect(stdout).not.toContain("lib.yml");
});

test("show without --changed takes an empty diff, so a paths: filter skips (PA-3)", () => {
  const { code, stdout } = run(...prArgs, ...prDate);
  expect(code).toBe(0);
  expect(verdictLines(stdout)).toBe(
    "ci.yml: skipped (root PA-3, line 4)\n" +
      "ci.yml › build: no-run (root PA-3, line 4)\n",
  );
});

test("show --changed with a file it can't read exits 2 and names it", () => {
  const { code, stderr } = run(
    ...prArgs,
    "--changed",
    "missing.txt",
    ...prDate,
  );
  expect(code).toBe(2);
  expect(stderr).toContain("can't read --changed missing.txt");
});

test("show in a folder without .github/workflows/ exits 2 and names the folder", () => {
  const empty = fileURLToPath(new URL("fixtures", import.meta.url));
  const { code, stderr } = run(
    "show",
    "--repo",
    empty,
    "--event",
    "push",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(2);
  expect(stderr).toContain(".github/workflows/");
});
