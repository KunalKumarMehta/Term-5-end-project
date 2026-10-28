import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

// The dedented `run: |` block of the release.yml step with this name.
function stepScript(name: string): string {
  const lines = workflow.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  expect(start, `step "${name}"`).toBeGreaterThan(-1);
  const run = lines.findIndex((l, i) => i > start && l.trim() === "run: |");
  const indent = lines[run]!.search(/\S/) + 2;
  const body: string[] = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && line.search(/\S/) < indent) break;
    body.push(line.slice(indent));
  }
  return body.join("\n");
}

// Runs a step the way GitHub's ubuntu runner does: bash -eo pipefail.
function runStep(name: string, env: Record<string, string>, cwd?: string) {
  return spawnSync(
    "bash",
    ["--noprofile", "--norc", "-eo", "pipefail", "-c", stepScript(name)],
    { cwd, env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" },
  );
}

// In GitHub's filter syntax `+` and `[]` mean what they mean in a regex and
// `.` is literal, so escaping the dots turns this trigger into a regex.
const trigger = /tags: \["(.+)"\]/.exec(workflow)![1]!;
const triggerRegex = new RegExp(`^${trigger.replaceAll(".", "\\.")}$`);

test.each(["v0.1.0", "v1.0.0", "v10.20.30"])(
  "the trigger and verify accept the full tag %s",
  (tag) => {
    expect(tag).toMatch(triggerRegex);
    expect(
      runStep("Check the tag format", { GITHUB_REF_NAME: tag }).status,
    ).toBe(0);
  },
);

test.each(["v1", "v1.0", "v1.0.0-rc.1", "1.0.0", "v1.0.0.0"])(
  "the trigger and verify reject %s",
  (tag) => {
    expect(tag).not.toMatch(triggerRegex);
    expect(
      runStep("Check the tag format", { GITHUB_REF_NAME: tag }).status,
    ).toBe(1);
  },
);

const sampleChangelog = `# Changelog

## [0.3.0] - 2026-12-01

## [0.2.0] - 2026-11-20

### Added

- Flow 2.

## [0.1.0] - 2026-11-10

### Added

- Flow 1.
`;

function extractNotes(tag: string) {
  const dir = mkdtempSync(join(tmpdir(), "whynorun-release-"));
  writeFileSync(join(dir, "CHANGELOG.md"), sampleChangelog);
  const result = runStep(
    "Extract the release notes",
    { GITHUB_REF_NAME: tag, RUNNER_TEMP: dir },
    dir,
  );
  const notes =
    result.status === 0 ? readFileSync(join(dir, "notes.md"), "utf8") : null;
  return { status: result.status, notes };
}

test("the notes are exactly the tagged version's CHANGELOG section", () => {
  expect(extractNotes("v0.2.0")).toEqual({
    status: 0,
    notes: "\n### Added\n\n- Flow 2.\n\n",
  });
  expect(extractNotes("v0.1.0")).toEqual({
    status: 0,
    notes: "\n### Added\n\n- Flow 1.\n",
  });
});

test("an empty or missing CHANGELOG section fails verify", () => {
  expect(extractNotes("v0.3.0").status).toBe(1);
  expect(extractNotes("v0.4.0").status).toBe(1);
});

test("the real CHANGELOG has notes for package.json's version", () => {
  const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  const dir = mkdtempSync(join(tmpdir(), "whynorun-release-"));
  const result = runStep(
    "Extract the release notes",
    { GITHUB_REF_NAME: `v${version}`, RUNNER_TEMP: dir },
    fileURLToPath(new URL("..", import.meta.url)),
  );
  expect(result.status, result.stdout).toBe(0);
  expect(readFileSync(join(dir, "notes.md"), "utf8")).toContain("### Added");
});
