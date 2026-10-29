import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { parse } from "yaml";
import { run } from "./main";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

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

function action(tests?: string) {
  const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  const code = run(tests);
  const text = (spy: typeof stdout) => spy.mock.calls.map((c) => c[0]).join("");
  return { code, stdout: text(stdout), stderr: text(stderr) };
}

const fixture = (name: string) =>
  fileURLToPath(new URL(`../cli/fixtures/${name}`, import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));

test("the Action runs whynorun test with each line of its tests input as a pattern", () => {
  process.chdir(fixture("tests-pass"));
  expect(action("  .github/whynorun/push.test.yml  \n\n").code).toBe(0);

  const { code, stderr } = action(
    ".github/whynorun/push.test.yml\nmissing/*.test.yml\n",
  );
  expect(code).toBe(2);
  expect(stderr).toContain("no Test files match missing/*.test.yml");
});

test("an empty tests input means whynorun test's default patterns", () => {
  process.chdir(fixture("tests-pass"));
  expect(action("").code).toBe(0);
  expect(action().code).toBe(0);
});

test("action.yml runs dist/action.mjs on node24, with tests as its only input", () => {
  const metadata = parse(readFileSync(join(repo, "action.yml"), "utf8")) as {
    inputs: Record<string, { default: string }>;
    runs: unknown;
  };
  expect(metadata.runs).toEqual({ using: "node24", main: "dist/action.mjs" });
  expect(Object.keys(metadata.inputs)).toEqual(["tests"]);
  expect(metadata.inputs.tests!.default).toBe(".github/whynorun/**/*.test.yml");
});

test("npm ships the CLI bundle but not the Action's", () => {
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  ) as [{ files: { path: string }[] }];
  const paths = pack.files.map((f) => f.path);
  expect(paths).toContain("dist/whynorun.mjs");
  expect(paths).not.toContain("dist/action.mjs");
});

test("dogfood: this repo's own Test files pass", () => {
  process.chdir(repo);
  const { code, stdout } = action(".github/whynorun/**/*.test.yml");
  expect(stdout).toBe(`whynorun ${version}\n`);
  expect(code).toBe(0);
});

// The ticket's throwaway paths: commit (#85), kept as a test instead of pushed.
test("dogfood: a paths: filter on ci.yml's pull_request fails the run, annotated on the paths: line", () => {
  const copy = mkdtempSync(join(tmpdir(), "whynorun-dogfood-"));
  try {
    cpSync(join(repo, ".github"), join(copy, ".github"), { recursive: true });
    const ci = join(copy, ".github/workflows/ci.yml");
    const lines = readFileSync(ci, "utf8").split("\n");
    const at = lines.indexOf("  pull_request:");
    expect(at).toBeGreaterThan(-1);
    lines.splice(at + 1, 0, "    paths: [src/**]");
    writeFileSync(ci, lines.join("\n"));
    const summary = join(copy, "summary.md");
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("GITHUB_STEP_SUMMARY", summary);
    process.chdir(copy);

    const { code, stderr } = action(".github/whynorun/**/*.test.yml");
    expect(code).toBe(1);
    const annotations = stderr
      .split("\n")
      .filter((l) => l.startsWith("::error"));
    // The inserted line is at index at + 1, so line at + 2.
    const onPaths = `::error file=.github/workflows/ci.yml,line=${at + 2}::`;
    expect(annotations.filter((a) => a.startsWith(onPaths))).toEqual([
      `${onPaths}Docs-only PR (.github/whynorun/docs-only-pr.test.yml): ci.yml › test: runs → no-run (root WN-2 → PA-2)`,
      `${onPaths}Docs-only PR (.github/whynorun/docs-only-pr.test.yml): ci.yml › e2e: runs → no-run (root WN-2 → PA-2)`,
    ]);
    // The checks' new root (RQ-1) has no YAML span, so they're on their pins' lines.
    expect(annotations.join("\n")).toContain(
      "check › test: passes → pending and blocks merge",
    );
    expect(readFileSync(summary, "utf8")).toContain("check › test");
  } finally {
    process.chdir(cwd);
    rmSync(copy, { recursive: true, force: true });
  }
});
