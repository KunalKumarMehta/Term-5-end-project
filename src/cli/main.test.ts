import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PLATFORM_BASELINE, simulate, type Scenario } from "../core";
import { main } from "./main";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const fixture = fileURLToPath(new URL("fixtures/repo", import.meta.url));
const cwd = process.cwd();

// This suite runs in GitHub Actions too: only the tests that want CI output get it.
beforeEach(() => {
  vi.stubEnv("GITHUB_ACTIONS", "");
  vi.stubEnv("GITHUB_STEP_SUMMARY", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

/** The bundled example set (#15 §2), as a repo folder. */
function exampleRepo(): string {
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
  return repo;
}

test("show --event pull_request_target --actor fork on the example set: triage.yml fails on 2026-12-03 (root PRT-2, assumed facts labelled), and its checkout fails the job on 2026-12-01 (root CO-1) with a write token and secrets", () => {
  const repo = exampleRepo();
  const show = (date: string) =>
    run(
      "show",
      "--repo",
      repo,
      "--event",
      "pull_request_target",
      "--actor",
      "fork",
      "--date",
      date,
    );
  try {
    const blocked = show("2026-12-03");
    expect(blocked.code).toBe(0);
    expect(blocked.stdout).toContain(
      "\ntriage.yml: fails (root PRT-2; WN-5 assumed repo.visibility = public; WN-5 assumed repo.predates = true; WN-5 assumed repo.eventPolicy = none)\n",
    );
    expect(blocked.stdout).toContain(
      "\ntriage.yml › triage: no-run (root PRT-2;",
    );

    const before = show("2026-12-01").stdout;
    expect(before).toContain("\ntriage.yml: runs (root EV-0, line 3)\n");
    expect(before).toContain(
      "\ntriage.yml › triage: fails (root CO-1, line 12)\n",
    );
    expect(before).toContain(
      "\ntriage.yml › triage › token.pull-requests: write (root PERM-3, line 6)\n",
    );
    expect(before).toContain(
      "\ntriage.yml › triage › secrets: available (root FK-7)\n",
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("show --event pull_request --actor fork on the example set: the Fork PR's Verdicts (snapshot)", () => {
  const repo = exampleRepo();
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

const testsFixture = (name: string) =>
  fileURLToPath(new URL(`fixtures/tests-${name}`, import.meta.url));

test("test exits 0 with only the version line when every pin matches", () => {
  process.chdir(testsFixture("pass"));
  expect(run("test")).toEqual({
    code: 0,
    stdout: `whynorun ${version}\n`,
    stderr: "",
  });
});

test("test exits 1 with one line per changed pin, under its file and label", () => {
  process.chdir(testsFixture("changed"));
  expect(run("test")).toEqual({
    code: 1,
    stdout: [
      `whynorun ${version}`,
      "",
      ".github/whynorun/fork-pr.test.yml: Fork PR",
      "ci.yml › test › secrets: available → empty (root FK-0 → FK-2)",
      "",
    ].join("\n"),
    stderr: "",
  });
});

test("test exits 2 on an invalid Test file: an unquoted true in repo.vars is rejected at its line", () => {
  process.chdir(testsFixture("invalid"));
  expect(run("test")).toEqual({
    code: 2,
    stdout: "",
    stderr:
      ".github/whynorun/vars.test.yml:9: /tests/0/scenario/repo/vars/DEPLOY quote it: GitHub variables and job outputs are always strings\n",
  });
});

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** A repo of `workflows` (a fixture repo or the example set) and these Test files, made the cwd. */
function testRepo(workflows: string, tests: Record<string, string>): string {
  const repo = mkdtempSync(join(tmpdir(), "whynorun-tests-"));
  temps.push(repo);
  cpSync(
    join(workflows, ".github", "workflows"),
    join(repo, ".github", "workflows"),
    {
      recursive: true,
    },
  );
  for (const [name, text] of Object.entries(tests)) {
    const path = join(repo, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  process.chdir(repo);
  return repo;
}
const example = () => {
  const repo = exampleRepo();
  temps.push(repo);
  return repo;
};

// The example's Fork PR Scenario (#15 §2), as a Test file holds it.
const forkPr = (pins: string, extra = "") => `version: 1
tests:
  - label: Fork PR
    scenario:
      event: { name: pull_request, actor: fork, ref: feature, base: main, changed: [src/app.ts] }
      followUp: { name: pull_request, type: synchronize, actor: fork, ref: feature, base: main, changed: [src/app.ts] }
      repo: { date: 2026-12-03, required: [build, test] }
${extra}    pins:
${pins}`;

test("test compares only the pinned fields: a missing field isn't compared, possible is a set, and null means the Verdict must not have the field", () => {
  testRepo(example(), {
    ".github/whynorun/fork-pr.test.yml": forkPr(
      [
        "      ci.yml › build: { value: runs }",
        "      ci.yml › e2e: { value: uncertain, possible: [skipped, runs], root: WN-4 }",
        "      ci.yml › changes: { value: runs, possible: [runs] }",
        "      ci.yml › concurrency.A: { value: cancelled, group: null, root: CC-2 }",
        "      ci.yml › concurrency.B: { value: pending, possible: null, root: CC-1 }",
        "",
      ].join("\n"),
    ),
  });
  expect(run("test")).toEqual({
    code: 1,
    stdout: [
      `whynorun ${version}`,
      "",
      ".github/whynorun/fork-pr.test.yml: Fork PR",
      "ci.yml › changes: runs (possible {runs} → —)",
      "ci.yml › concurrency.A: cancelled (group — → ci-feature)",
      "ci.yml › concurrency.B: pending → runs (root CC-1 → CC-2)",
      "",
    ].join("\n"),
    stderr: "",
  });
});

test("test reports a pinned subject that isn't found, with candidates of the same kind, and never follows the rename", () => {
  testRepo(example(), {
    ".github/whynorun/fork-pr.test.yml": forkPr(
      "      ci.yml › tests: { value: runs }\n      check › tset: { value: passes }\n",
    ),
  });
  const { code, stdout } = run("test");
  expect(code).toBe(1);
  expect(lastBlock(stdout)).toBe(
    [
      ".github/whynorun/fork-pr.test.yml: Fork PR",
      "pinned subject not found: ci.yml › tests (candidates: ci.yml › build, ci.yml › changes, ci.yml › e2e, ci.yml › test)",
      "pinned subject not found: check › tset (candidates: check › build, check › test)",
      "",
    ].join("\n"),
  );
});

test("test reports an Assumption that names no subject as assumed subject not found, with candidates", () => {
  testRepo(example(), {
    ".github/whynorun/fork-pr.test.yml": forkPr(
      "      ci.yml › build: { value: runs }\n",
      '      assume: { "ci.yml › change › outputs.src": "true" }\n',
    ),
  });
  const { code, stdout } = run("test");
  expect(code).toBe(1);
  expect(lastBlock(stdout)).toBe(
    [
      ".github/whynorun/fork-pr.test.yml: Fork PR",
      "assumed subject not found: ci.yml › change › outputs.src (candidates: ci.yml › build, ci.yml › changes, ci.yml › e2e, ci.yml › test)",
      "",
    ].join("\n"),
  );
});

const pushTest = (pins: string) => `version: 1
tests:
  - label: Push
    scenario:
      event: { name: push }
      repo: { date: 2026-12-03 }
    pins:
${pins}`;

test("test fails on any Diagnostic, even when every pin matches, and pins on the broken file report file has Diagnostics once", () => {
  const broken = fileURLToPath(
    new URL("fixtures/broken-repo", import.meta.url),
  );
  testRepo(broken, {
    ".github/whynorun/a.test.yml": pushTest(
      "      ci.yml: { value: runs, root: EV-0 }\n",
    ),
    ".github/whynorun/b.test.yml": pushTest(
      "      broken.yml: { value: runs }\n      broken.yml › build: { value: runs }\n",
    ),
  });
  expect(run("test")).toEqual({
    code: 1,
    stdout: [
      `whynorun ${version}`,
      "",
      ".github/workflows/broken.yml:3: Unexpected value 'branchez'",
      "",
      ".github/whynorun/b.test.yml: Push",
      "broken.yml: file has Diagnostics",
      "",
    ].join("\n"),
    stderr: "",
  });
});

test("test reports an unsupported Scenario once per test, and still compares a pin on event", () => {
  testRepo(testsFixture("pass"), {
    ".github/whynorun/schedule.test.yml": `version: 1
tests:
  - label: Nightly
    scenario: { event: { name: schedule }, repo: { date: 2026-12-03 } }
    pins:
      event: { value: unsupported, root: WN-3 }
      ci.yml: { value: runs }
      ci.yml › test: { value: runs }
  - label: Nightly again
    scenario: { event: { name: schedule }, repo: { date: 2026-12-03 } }
    pins:
      event: { value: runs }
`,
  });
  expect(run("test")).toEqual({
    code: 1,
    stdout: [
      `whynorun ${version}`,
      "",
      ".github/whynorun/schedule.test.yml: Nightly",
      "Scenario unsupported (root WN-3): event.name = schedule, event.actor = member",
      "",
      ".github/whynorun/schedule.test.yml: Nightly again",
      "Scenario unsupported (root WN-3): event.name = schedule, event.actor = member",
      "event: runs → unsupported",
      "",
    ].join("\n"),
    stderr: "",
  });
});

const one = (scenario: string, pins = "      ci.yml: { value: runs }\n") =>
  `version: 1\ntests:\n  - label: Push\n    scenario: ${scenario}\n    pins:\n${pins}`;
const push = "{ event: { name: push }, repo: { date: 2026-12-03 } }";

test.each([
  [
    "a YAML syntax error",
    "version: 1\ntests: [\n",
    "x.test.yml:3: Flow sequence in block collection must be sufficiently indented and end with a ]",
  ],
  [
    "an alias bomb",
    `version: 1\nx: &x 1\ny: [${"*x, ".repeat(1001)}]\n`,
    "x.test.yml:1: Excessive alias count indicates a resource exhaustion attack",
  ],
  [
    "a newer version",
    `version: 2\ntests: []\n`,
    "x.test.yml:1: version 2 isn't supported: this WhyNoRun reads Test file version 1",
  ],
  [
    "a file with no tests",
    "version: 1\ntests: []\n",
    "x.test.yml:2: /tests must NOT have fewer than 1 items",
  ],
  [
    "a test with no pins",
    one(push, "      {}\n"),
    "x.test.yml:6: /tests/0/pins must NOT have fewer than 1 properties",
  ],
  [
    "a label used twice",
    `${one(push)}${one(push).slice("version: 1\ntests:\n".length)}`,
    "x.test.yml:7: label `Push` is used by another test in this file",
  ],
  [
    "an unquoted output Assumption",
    one(
      `{ event: { name: push }, repo: { date: 2026-12-03 },\n      assume: { "ci.yml › test › outputs.ok": true } }`,
    ),
    "x.test.yml:5: /tests/0/scenario/assume/ci.yml › test › outputs.ok quote it: GitHub variables and job outputs are always strings",
  ],
  [
    "an owner/repo that isn't owner/repo",
    one(
      "{ event: { name: push }, repo: { date: 2026-12-03, repository: acme } }",
    ),
    "x.test.yml:4: /tests/0/scenario/repo/repository use the form owner/repo, e.g. acme/app",
  ],
  [
    "a pin field that isn't value, possible, root, group or continuing",
    one(push, "      ci.yml: { value: runs, settle: [] }\n"),
    "x.test.yml:6: /tests/0/pins/ci.yml/settle must NOT have additional properties",
  ],
])("test exits 2 on %s, at file:line", (_, text, message) => {
  testRepo(testsFixture("pass"), { "x.test.yml": text });
  expect(run("test", "x.test.yml")).toEqual({
    code: 2,
    stdout: "",
    stderr: `${message}\n`,
  });
});

test("test exits 2 on a Test file it can't read, and names it", () => {
  testRepo(testsFixture("pass"), { "dir.test.yml/keep": "" });
  expect(run("test", "dir.test.yml")).toEqual({
    code: 2,
    stdout: "",
    stderr: "dir.test.yml: can't read it (EISDIR)\n",
  });
});

test("test with no Test files exits 2, names the pattern and suggests a nearby .test.yaml", () => {
  testRepo(testsFixture("pass"), {
    ".github/whynorun/push.test.yaml": pushTest(
      "      ci.yml: { value: runs }\n",
    ),
  });
  expect(run("test")).toEqual({
    code: 2,
    stdout: "",
    stderr:
      "whynorun: no Test files match .github/whynorun/**/*.test.yml; Test files end in .test.yml, so these don't count: .github/whynorun/push.test.yaml\n",
  });
  vi.restoreAllMocks();
  expect(run("test", "other.test.yml")).toMatchObject({
    code: 2,
    stderr: expect.stringMatching(
      /^whynorun: no Test files match other\.test\.yml;/,
    ),
  });
});

test("test expands each argument as a glob from the cwd, de-duplicated and sorted", () => {
  const changed = readFileSync(
    join(testsFixture("changed"), ".github", "whynorun", "fork-pr.test.yml"),
    "utf8",
  );
  testRepo(testsFixture("changed"), {
    "b.test.yml": changed,
    "a.test.yml": changed,
  });
  const { code, stdout } = run("test", "b.test.yml", "*.test.yml");
  expect(code).toBe(1);
  expect(stdout.match(/^.*: Fork PR$/gm)).toEqual([
    "a.test.yml: Fork PR",
    "b.test.yml: Fork PR",
  ]);
});

test("test without .github/workflows/ exits 2 and names the folder", () => {
  const repo = mkdtempSync(join(tmpdir(), "whynorun-tests-"));
  temps.push(repo);
  writeFileSync(join(repo, "x.test.yml"), one(push));
  process.chdir(repo);
  const { code, stderr } = run("test", "x.test.yml");
  expect(code).toBe(2);
  expect(stderr).toContain(".github/workflows/");
});

// A fork's PR on the tests fixture: release is skipped at its if: (JG-3, line 12), and
// secrets go empty (FK-2, which has no YAML span).
const forkPrPins = `version: 1
tests:
  - label: Fork PR
    scenario:
      event: { name: pull_request, actor: fork, ref: feature, base: main }
      repo: { date: 2026-12-03 }
    pins:
      ci.yml › release: { value: runs }
      ci.yml › tset: { value: runs }
      ci.yml › test › secrets: { value: available, root: FK-0 }
      ci.yml › test: { value: runs }
`;

/** Runs `whynorun test` as GitHub Actions does, with a step summary that already has a line. */
function inActions(...argv: string[]) {
  const summary = join(process.cwd(), "summary.md");
  writeFileSync(summary, "earlier step\n");
  vi.stubEnv("GITHUB_ACTIONS", "true");
  vi.stubEnv("GITHUB_STEP_SUMMARY", summary);
  const result = run("test", ...argv);
  return { ...result, summary: readFileSync(summary, "utf8") };
}

test("with GITHUB_ACTIONS=true, test annotates the new root's YAML line, or the pin's line when the root has no span, and appends a diff table to the step summary", () => {
  testRepo(testsFixture("changed"), {
    ".github/whynorun/fork-pr.test.yml": forkPrPins,
  });
  const { code, stderr, summary } = inActions();
  expect(code).toBe(1);
  expect(stderr).toMatchInlineSnapshot(`
    "::error file=.github/workflows/ci.yml,line=12::Fork PR (.github/whynorun/fork-pr.test.yml): ci.yml › release: runs → skipped
    ::error file=.github/whynorun/fork-pr.test.yml,line=9::Fork PR (.github/whynorun/fork-pr.test.yml): pinned subject not found: ci.yml › tset (candidates: ci.yml › release, ci.yml › test)
    ::error file=.github/whynorun/fork-pr.test.yml,line=10::Fork PR (.github/whynorun/fork-pr.test.yml): ci.yml › test › secrets: available → empty (root FK-0 → FK-2)
    "
  `);
  expect(summary.replaceAll(version, "<version>")).toMatchInlineSnapshot(`
    "earlier step
    ### whynorun <version>

    | Test | Subject | Pinned | Now |
    | --- | --- | --- | --- |
    | .github/whynorun/fork-pr.test.yml: Fork PR | ci.yml › release | runs | skipped |
    | .github/whynorun/fork-pr.test.yml: Fork PR | ci.yml › tset | — | pinned subject not found (candidates: ci.yml › release, ci.yml › test) |
    | .github/whynorun/fork-pr.test.yml: Fork PR | ci.yml › test › secrets | available; root FK-0 | empty; root FK-2 |
    "
  `);
});

test("test --json prints exactly one JSON document on stdout, starting with format 1 and the version, with the annotations on stderr", () => {
  testRepo(testsFixture("changed"), {
    ".github/whynorun/fork-pr.test.yml": forkPrPins,
  });
  const { code, stdout, stderr } = inActions("--json");
  expect(code).toBe(1);
  expect(stdout).toMatch(/^\{\n {2}"format": 1,\n {2}"version": "[^"]+",\n/);
  expect(JSON.parse(stdout)).toEqual({
    format: 1,
    version,
    diagnostics: [],
    tests: [
      {
        file: ".github/whynorun/fork-pr.test.yml",
        label: "Fork PR",
        findings: [
          {
            status: "changed",
            key: "ci.yml › release",
            value: "skipped",
            changes: [{ field: "value", pinned: "runs", now: "skipped" }],
          },
          {
            status: "pinned subject not found",
            key: "ci.yml › tset",
            candidates: ["ci.yml › release", "ci.yml › test"],
          },
          {
            status: "changed",
            key: "ci.yml › test › secrets",
            value: "empty",
            changes: [
              { field: "value", pinned: "available", now: "empty" },
              { field: "root", pinned: "FK-0", now: "FK-2" },
            ],
          },
          { status: "match", key: "ci.yml › test" },
        ],
        note: null,
      },
    ],
  });
  expect(stderr.match(/^::error /gm)).toHaveLength(3);
});

test("test --json outside GitHub Actions prints no annotations, and a pin pinned as absent stays null", () => {
  process.chdir(testsFixture("pass"));
  const { code, stdout, stderr } = run("test", "--json");
  expect(code).toBe(0);
  expect(stderr).toBe("");
  const doc = JSON.parse(stdout) as { tests: { findings: unknown[] }[] };
  expect(doc.tests[0]!.findings).toEqual([
    { status: "match", key: "ci.yml" },
    { status: "match", key: "ci.yml › test" },
    { status: "match", key: "ci.yml › release" },
    { status: "match", key: "ci.yml › test › secrets" },
  ]);
});

test("a failing pin in a pull_request_target Scenario adds the DB-4 note to its text, annotations, step summary and JSON", () => {
  testRepo(testsFixture("pass"), {
    ".github/whynorun/target.test.yml": `version: 1
tests:
  - label: Fork target
    scenario:
      event: { name: pull_request_target, actor: fork, ref: feature, base: main }
      repo: { date: 2026-12-03 }
    pins:
      ci.yml › test: { value: runs }
`,
  });
  const note = "this Verdict describes behaviour after merge (DB-4)";
  const text = inActions();
  expect(text.code).toBe(1);
  expect(lastBlock(text.stdout)).toBe(
    [
      ".github/whynorun/target.test.yml: Fork target",
      "ci.yml › test: runs → no-run",
      `note: ${note}`,
      "",
    ].join("\n"),
  );
  expect(text.stderr).toBe(
    `::error file=.github/workflows/ci.yml,line=2::Fork target (.github/whynorun/target.test.yml): ci.yml › test: runs → no-run; ${note}\n`,
  );
  expect(text.summary).toContain(
    `\n- .github/whynorun/target.test.yml: Fork target: ${note}\n`,
  );
  vi.restoreAllMocks();
  const json = inActions("--json");
  expect(
    (JSON.parse(json.stdout) as { tests: { note: string }[] }).tests[0]!.note,
  ).toBe(note);
});

test("with GITHUB_ACTIONS=true, an unsupported Scenario is annotated at its event, and an Assumption that names no subject at its line", () => {
  testRepo(testsFixture("pass"), {
    ".github/whynorun/x.test.yml": `version: 1
tests:
  - label: Nightly
    scenario:
      event: { name: schedule }
      repo: { date: 2026-12-03 }
    pins:
      ci.yml: { value: runs }
  - label: Push
    scenario:
      event: { name: push }
      repo: { date: 2026-12-03 }
      assume: { "ci.yml › tset › outputs.ok": "true" }
    pins:
      ci.yml: { value: runs }
`,
  });
  expect(inActions().stderr).toBe(
    [
      "::error file=.github/whynorun/x.test.yml,line=5::Nightly (.github/whynorun/x.test.yml): Scenario unsupported (root WN-3): event.name = schedule, event.actor = member",
      "::error file=.github/whynorun/x.test.yml,line=13::Push (.github/whynorun/x.test.yml): assumed subject not found: ci.yml › tset › outputs.ok (candidates: ci.yml › release, ci.yml › test)",
      "",
    ].join("\n"),
  );
});

test("show --from <file> --scenario <label> prints the Merge-readiness badges with --flow checks, and runs A and B with --flow concurrency", () => {
  testRepo(example(), {
    "fork-pr.test.yml": forkPr("      ci.yml: { value: runs }\n").replace(
      "tests:\n",
      "tests:\n  - label: Push\n    scenario: { event: { name: push }, repo: { date: 2026-12-03 } }\n    pins: { ci.yml: { value: runs } }\n",
    ),
  });
  const show = (flow: string) =>
    run(
      "show",
      "--from",
      "fork-pr.test.yml",
      "--scenario",
      "Fork PR",
      "--flow",
      flow,
    );
  const checks = show("checks");
  expect(checks.code).toBe(0);
  expect(lastBlock(checks.stdout)).toBe(
    "check › build: passes (root RQ-4; WN-5 assumed event.approval = approved)\n" +
      "check › test: passes (root RQ-4; WN-5 assumed event.approval = approved)\n",
  );
  const concurrency = show("concurrency");
  expect(concurrency.code).toBe(0);
  expect(lastBlock(concurrency.stdout)).toBe(
    [
      "ci.yml › concurrency.A: cancelled (root CC-2, line 13; WN-5 assumed repo.visibility = public; WN-5 assumed event.approval = approved)",
      "ci.yml › concurrency.B: runs (root CC-2, line 13; WN-5 assumed repo.visibility = public; WN-5 assumed event.approval = approved)",
      "deploy.yml › concurrency.A: no-run (root EV-0, line 3)",
      "deploy.yml › concurrency.B: no-run (root EV-0, line 3; WN-5 assumed repo.visibility = public)",
      "",
    ].join("\n"),
  );
});

test("show --from can't be combined with the Scenario flags, needs --scenario for a file of several tests, and names the labels", () => {
  testRepo(testsFixture("pass"), {
    "two.test.yml": `${one(push)}${one(push).slice("version: 1\ntests:\n".length).replace("Push", "Again")}`,
  });
  const combined = run("show", "--from", "two.test.yml", "--event", "push");
  expect(combined.code).toBe(2);
  expect(combined.stderr).toContain("--from can't be combined with --event");
  const unpicked = run("show", "--from", "two.test.yml");
  expect(unpicked.code).toBe(2);
  expect(unpicked.stderr).toContain("--scenario <label> (Push, Again)");
  const unknown = run("show", "--from", "two.test.yml", "--scenario", "Nope");
  expect(unknown.code).toBe(2);
  expect(unknown.stderr).toContain(
    "no test labelled Nope in two.test.yml (Push, Again)",
  );
  expect(
    run("show", "--from", "two.test.yml", "--scenario", "Again").code,
  ).toBe(0);
});

test("show --from an invalid Test file exits 2 with its file:line messages", () => {
  process.chdir(testsFixture("invalid"));
  expect(run("show", "--from", ".github/whynorun/vars.test.yml")).toEqual({
    code: 2,
    stdout: "",
    stderr:
      ".github/whynorun/vars.test.yml:9: /tests/0/scenario/repo/vars/DEPLOY quote it: GitHub variables and job outputs are always strings\n",
  });
});

test("prototype pollution (#14 §6.7): the core's input loaded through a Test file gives the same Verdicts as simulate()", () => {
  // One job per condition on a member's pull_request, as the core test has it.
  const conditions = {
    ctor: "vars.CONSTRUCTOR == 'a'",
    proto: "vars.__proto__ == 'b'",
    payload: "github.event.__proto__.x == 'c'",
  };
  const workflow = {
    path: ".github/workflows/pr.yml",
    text:
      "on: pull_request\njobs:\n" +
      Object.entries(conditions)
        .map(
          ([id, condition]) =>
            `  ${id}:\n    if: ${condition}\n    runs-on: x\n    steps:\n      - run: echo\n`,
        )
        .join(""),
  };
  const scenario = JSON.parse(
    `{"event":{"name":"pull_request","payload":{"__proto__":{"x":"c"}}},
      "repo":{"date":"2026-12-03","vars":{"CONSTRUCTOR":"a","__proto__":"b"}}}`,
  ) as Scenario;
  const { verdicts } = simulate([workflow], scenario);
  expect(
    ["ctor", "proto", "payload"].map(
      (id) => verdicts.find((v) => v.key === `pr.yml › ${id}`)?.value,
    ),
  ).toEqual(["runs", "runs", "runs"]);

  // Every Verdict simulate() gives, pinned in full.
  const pins = verdicts
    .map(
      (v) =>
        `      ${JSON.stringify(v.key)}: ${JSON.stringify({
          value: v.value,
          possible: v.possible ?? null,
          root: v.causes[0]?.rule ?? null,
        })}\n`,
    )
    .join("");
  const repo = mkdtempSync(join(tmpdir(), "whynorun-tests-"));
  temps.push(repo);
  mkdirSync(join(repo, ".github", "workflows"), { recursive: true });
  writeFileSync(join(repo, workflow.path), workflow.text);
  testRepo(repo, {
    "pollution.test.yml": `version: 1
tests:
  - label: Polluting keys
    scenario:
      event: { name: pull_request, payload: { __proto__: { x: c } } }
      repo: { date: 2026-12-03, vars: { CONSTRUCTOR: a, __proto__: b } }
    pins:
${pins}`,
  });
  expect(run("test", "pollution.test.yml")).toEqual({
    code: 0,
    stdout: `whynorun ${version}\n`,
    stderr: "",
  });
  expect(({} as Record<string, unknown>).x).toBeUndefined();
  expect(Object.getPrototypeOf({})).toBe(Object.prototype);
});

test("test --update rewrites only the changed pins in place, keeping comments, and a deleted root stays deleted", () => {
  const path = ".github/whynorun/fork-pr.test.yml";
  const pinned = `# Pinned when the PR came from a member; it now comes from a fork.
version: 1
tests:
  - label: Fork PR # the demo's
    scenario:
      event: { name: pull_request, actor: fork, ref: feature, base: main }
      repo: { date: 2026-12-03 }
    pins:
      # The job itself still runs.
      ci.yml › test: { value: runs, root: WN-2 }
      ci.yml › test › secrets:
        value: available # a member gets them
      ci.yml › release › secrets: { value: available, root: FK-0 } # keep me
`;
  testRepo(testsFixture("changed"), { [path]: pinned });
  expect(run("test", "--update")).toEqual({
    code: 0,
    stdout: [
      `whynorun ${version}`,
      "",
      ".github/whynorun/fork-pr.test.yml: Fork PR",
      "ci.yml › test › secrets: available → empty",
      "ci.yml › release › secrets: available → empty (root FK-0 → FK-2)",
      "",
      `updated ${path}`,
      "",
    ].join("\n"),
    stderr: "",
  });
  expect(readFileSync(path, "utf8")).toBe(
    pinned
      .replace("value: available # a member", "value: empty # a member")
      .replace(
        "{ value: available, root: FK-0 } # keep me",
        "{ value: empty, root: FK-2 } # keep me",
      ),
  );
  // Accepted, the file now passes.
  expect(run("test").code).toBe(0);
});

test("test --update drops possible when the new Verdict lacks it, and adds it only when a pin moves from decided to Uncertain", () => {
  const path = ".github/whynorun/fork-pr.test.yml";
  testRepo(example(), {
    [path]: forkPr(
      [
        "      ci.yml › e2e: { value: runs }",
        "      ci.yml › changes: { value: runs, possible: [runs] }",
        "      ci.yml › concurrency.B: { value: pending, root: CC-1 }",
        "",
      ].join("\n"),
    ),
  });
  expect(run("test", "--update").code).toBe(0);
  expect(readFileSync(path, "utf8")).toBe(
    forkPr(
      [
        "      ci.yml › e2e: { value: uncertain, possible: [ runs, skipped ] }",
        "      ci.yml › changes: { value: runs }",
        "      ci.yml › concurrency.B: { value: runs, root: CC-2 }",
        "",
      ].join("\n"),
    ),
  );
});

test("test --update writes nothing and exits 1 when any pinned or assumed subject isn't found, there's a Diagnostic or a Scenario is unsupported", () => {
  const changed = forkPr("      ci.yml › build: { value: skipped }\n");
  const blockers: Record<string, string> = {
    "pin not found": forkPr(
      "      ci.yml › build: { value: skipped }\n      ci.yml › tests: { value: runs }\n",
    ),
    "assumption not found": forkPr(
      "      ci.yml › build: { value: skipped }\n",
      '      assume: { "ci.yml › change › outputs.src": "true" }\n',
    ),
    unsupported: one(
      "{ event: { name: schedule }, repo: { date: 2026-12-03 } }",
    ),
  };
  for (const [name, blocker] of Object.entries(blockers)) {
    const files = {
      ".github/whynorun/a.test.yml": changed,
      ".github/whynorun/b.test.yml": blocker,
    };
    testRepo(example(), files);
    const { code, stdout } = run("test", "--update");
    expect(code, name).toBe(1);
    expect(stdout, name).toContain(
      "\nwhynorun: --update wrote nothing: fix what blocks it above first\n",
    );
    for (const [path, text] of Object.entries(files))
      expect(readFileSync(path, "utf8"), name).toBe(text);
  }

  const broken = fileURLToPath(
    new URL("fixtures/broken-repo", import.meta.url),
  );
  const a = pushTest("      ci.yml: { value: skipped }\n");
  testRepo(broken, { ".github/whynorun/a.test.yml": a });
  expect(run("test", "--update").code).toBe(1);
  expect(readFileSync(".github/whynorun/a.test.yml", "utf8")).toBe(a);
});

test("test --update exits 2 and writes nothing when any Test file is invalid", () => {
  const changed = forkPr("      ci.yml › build: { value: skipped }\n");
  testRepo(example(), {
    ".github/whynorun/a.test.yml": changed,
    ".github/whynorun/b.test.yml": "version: 1\ntests: []\n",
  });
  expect(run("test", "--update").code).toBe(2);
  expect(readFileSync(".github/whynorun/a.test.yml", "utf8")).toBe(changed);
});

test("test --update exits 2 and writes nothing when any Test file it would rewrite can't be written", () => {
  const changed = forkPr("      ci.yml › build: { value: skipped }\n");
  const files = {
    ".github/whynorun/a.test.yml": changed,
    ".github/whynorun/b.test.yml": changed,
  };
  testRepo(example(), files);
  chmodSync(".github/whynorun/b.test.yml", 0o444);

  const { code, stderr } = run("test", "--update");
  expect(code).toBe(2);
  expect(stderr).toContain(".github/whynorun/b.test.yml: can't write it");
  for (const [path, text] of Object.entries(files))
    expect(readFileSync(path, "utf8")).toBe(text);
  expect(readdirSync(".github/whynorun").sort()).toEqual(
    Object.keys(files).map((p) => p.split("/").pop()),
  );
});
