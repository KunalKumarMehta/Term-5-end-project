import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  compareTest,
  parseTestFile,
  simulate,
  writeTestFile,
  type Scenario,
} from "./index";

// The bundled example Workflow set behind Load example (#15 §2).
const example = ["ci.yml", "deploy.yml", "triage.yml"].map((name) => ({
  path: `.github/workflows/${name}`,
  text: readFileSync(
    new URL(`../../playground/src/example/${name}`, import.meta.url),
    "utf8",
  ),
}));

// The demo's Fork PR after Settle (#15 §4, 1:44): Load example's Scenario plus the output.
const forkPr: Scenario = {
  event: {
    name: "pull_request",
    actor: "fork",
    ref: "feature",
    base: "main",
    changed: ["src/app.ts"],
  },
  followUp: {
    name: "pull_request",
    type: "synchronize",
    actor: "fork",
    ref: "feature",
    base: "main",
    changed: ["src/app.ts"],
  },
  repo: { date: "2026-12-03", required: ["build", "test"] },
  assume: { "ci.yml › changes › outputs.src": "true" },
};

const pinned = (scenario: Scenario, keys: string[]) =>
  simulate(example, scenario).verdicts.filter((v) => keys.includes(v.key));

test("the demo's four Fork PR pins save as a Test file with the $schema line, every default written out and every pin field that applies", () => {
  const text = writeTestFile([
    {
      label: "Fork PR",
      scenario: forkPr,
      pinned: pinned(forkPr, [
        "check › build",
        "check › test",
        "ci.yml › concurrency.A",
        "ci.yml › concurrency.B",
      ]),
    },
  ]);

  expect(text)
    .toBe(`# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/whynorun@1/schemas/test-file.schema.json
version: 1
tests:
  - label: Fork PR
    scenario:
      event:
        name: pull_request
        actor: fork
        ref: feature
        base: main
        changed:
          - src/app.ts
        approval: approved
        payload: {}
      followUp:
        name: pull_request
        type: synchronize
        actor: fork
        ref: feature
        base: main
        changed:
          - src/app.ts
        approval: approved
        payload: {}
        runA: in-progress
        pendingRuns: 0
      repo:
        date: 2026-12-03
        required:
          - build
          - test
        visibility: public
        predates: true
        defaultBranch: main
        tokenDefault: restricted
        eventPolicy: none
        strict: false
        mergeQueue: false
        vars: {}
      assume:
        ci.yml › changes › outputs.src: "true"
    pins:
      check › build:
        value: passes
        possible: null
        root: RQ-4
      check › test:
        value: passes
        possible: null
        root: RQ-4
      ci.yml › concurrency.A:
        value: cancelled
        possible: null
        root: CC-2
        group: ci-feature
        continuing: null
      ci.yml › concurrency.B:
        value: runs
        possible: null
        root: CC-2
        group: ci-feature
        continuing: null
`);
});

test("a saved Test file parses, and every pin matches the Verdicts it was written from", () => {
  const member: Scenario = {
    event: { name: "pull_request", ref: "feature", base: "main" },
    // __proto__ and constructor are valid GitHub variable names (#14 §6.7).
    repo: {
      date: "2026-12-03",
      vars: JSON.parse(
        '{ "FLAG": "true", "__proto__": "x", "constructor": "y" }',
      ),
    },
  };
  const tests = [
    {
      label: "Fork PR",
      scenario: forkPr,
      pinned: simulate(example, forkPr).verdicts,
    },
    {
      label: "Member PR",
      scenario: member,
      pinned: simulate(example, member).verdicts,
    },
  ];
  const parsed = parseTestFile("saved.test.yml", writeTestFile(tests));

  expect(parsed.errors).toBeUndefined();
  expect(parsed.file!.tests.map((t) => t.label)).toEqual([
    "Fork PR",
    "Member PR",
  ]);
  // GitHub's variables are strings: an unquoted true would flip == 'true' (#10 §2).
  expect(Object.entries(parsed.file!.tests[1]!.scenario.repo.vars!)).toEqual([
    ["FLAG", "true"],
    ["__proto__", "x"],
    ["constructor", "y"],
  ]);
  expect(({} as Record<string, unknown>).x).toBeUndefined();
  for (const t of parsed.file!.tests) {
    const findings = compareTest(t, simulate(example, t.scenario));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.filter((f) => f.status !== "match")).toEqual([]);
  }
});
