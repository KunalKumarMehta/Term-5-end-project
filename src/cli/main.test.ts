import { readFileSync } from "node:fs";
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
  expect(run("show", "--event", "push", "--date", "2026-12-03")).toEqual({
    code: 0,
    stdout: showOutput,
    stderr: "",
  });
});

test("show --repo <dir> reads another folder's .github/workflows/", () => {
  expect(
    run("show", "--repo", fixture, "--event", "push", "--date", "2026-12-03"),
  ).toEqual({ code: 0, stdout: showOutput, stderr: "" });
});

test.each(["all", "access"])(
  "show --flow %s prints what's available",
  (flow) => {
    expect(
      run(
        "show",
        "--repo",
        fixture,
        "--event",
        "push",
        "--date",
        "2026-12-03",
        "--flow",
        flow,
      ),
    ).toEqual({ code: 0, stdout: showOutput, stderr: "" });
  },
);

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
  expect(stdout).toMatch(
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
// The Verdict lines: everything after the last blank line.
const verdictLines = (stdout: string) =>
  stdout.slice(stdout.lastIndexOf("\n\n", stdout.length - 2) + 2);

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
    "release.yml: skipped (root BR-3, line 4)\n",
  );
});

test.each([
  ["main", "release.yml: runs (root BR-4, line 6)\n"],
  ["dev", "release.yml: skipped (root BR-4, line 6)\n"],
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

test("show --actor fork prints the Unsupported Verdict until fork PRs land", () => {
  const { code, stdout } = run(
    "show",
    "--repo",
    filters,
    "--event",
    "pull_request",
    "--actor",
    "fork",
    "--date",
    "2026-12-03",
  );
  expect(code).toBe(0);
  expect(verdictLines(stdout)).toBe("event: unsupported (root WN-3)\n");
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
