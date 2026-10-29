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

// The example with run A no longer cancelled when run B arrives.
const uncancelled = example.map((f) =>
  f.path.endsWith("ci.yml")
    ? {
        ...f,
        text: f.text.replace(
          "cancel-in-progress: true",
          "cancel-in-progress: false",
        ),
      }
    : f,
);

test("re-saving a loaded pin keeps its own field list: a matching pin as written, a changed one under test --update's add and drop rule", () => {
  const opened = parseTestFile(
    "fork-pr.test.yml",
    writeTestFile([
      {
        label: "Fork PR",
        scenario: forkPr,
        pinned: pinned(forkPr, ["check › build", "ci.yml › concurrency.A"]),
      },
    ]),
  ).file!;
  const loaded = opened.tests[0]!.pins;
  // The Maintainer loosened both pins by deleting root (#10 §3).
  delete loaded["check › build"]!.root;
  delete loaded["ci.yml › concurrency.A"]!.root;

  const resaved = parseTestFile(
    "fork-pr.test.yml",
    writeTestFile([
      {
        label: "Fork PR",
        scenario: forkPr,
        pinned: simulate(uncancelled, forkPr).verdicts.filter((v) =>
          Object.hasOwn(loaded, v.key),
        ),
        loaded,
      },
    ]),
  ).file!;

  expect(resaved.tests[0]!.pins).toEqual({
    "check › build": { value: "passes", possible: null },
    // value rewritten, the matching fields as written, root never re-added.
    "ci.yml › concurrency.A": {
      value: "runs",
      possible: null,
      group: "ci-feature",
      continuing: null,
    },
  });
});

test("a loaded pin gains possible when it turns Uncertain and drops it when it's decided again, and one whose subject is gone is written as loaded", () => {
  const scenario: Scenario = { ...forkPr, assume: {} };
  const loaded = {
    "ci.yml › e2e": { value: "runs" },
    "ci.yml › gone": { value: "runs", root: "WN-2" },
  };
  const file = parseTestFile(
    "e2e.test.yml",
    writeTestFile([
      {
        label: "Fork PR",
        scenario,
        pinned: simulate(example, scenario).verdicts.filter(
          (v) => v.key === "ci.yml › e2e",
        ),
        loaded,
      },
    ]),
  ).file!;

  expect(file.tests[0]!.pins).toEqual({
    "ci.yml › e2e": { value: "uncertain", possible: ["runs", "skipped"] },
    "ci.yml › gone": { value: "runs", root: "WN-2" },
  });

  // Settled, e2e runs: the Verdict has no possible, so the pin drops it.
  const settled = parseTestFile(
    "e2e.test.yml",
    writeTestFile([
      {
        label: "Fork PR",
        scenario: forkPr,
        pinned: pinned(forkPr, ["ci.yml › e2e"]),
        loaded: file.tests[0]!.pins,
      },
    ]),
  ).file!;
  expect(settled.tests[0]!.pins["ci.yml › e2e"]).toEqual({ value: "runs" });
});

test("saving over an opened Test file keeps its unopened tests verbatim and in order, matching saved entries by label", () => {
  const original = parseTestFile(
    "three.test.yml",
    `version: 1
tests:
  - label: One
    scenario: { event: { name: push }, repo: { date: 2026-12-03 } }
    pins: { ci.yml: { value: runs } }
  - label: Fork PR
    scenario: { event: { name: push }, repo: { date: 2026-12-03 } }
    pins: { ci.yml: { value: runs } }
  - label: Three
    scenario: { event: { name: push }, repo: { date: 2026-01-01 } }
    pins: { ci.yml: { root: EV-0 } }
`,
  ).file!;

  const saved = parseTestFile(
    "three.test.yml",
    writeTestFile(
      [
        {
          label: "Fork PR",
          scenario: forkPr,
          pinned: pinned(forkPr, ["check › build"]),
        },
        { label: "New", scenario: forkPr, pinned: pinned(forkPr, ["ci.yml"]) },
      ],
      original,
    ),
  ).file!;

  expect(saved.tests.map((t) => t.label)).toEqual([
    "One",
    "Fork PR",
    "Three",
    "New",
  ]);
  expect(saved.tests[0]).toEqual(original.tests[0]);
  expect(saved.tests[2]).toEqual(original.tests[2]);
  expect(Object.keys(saved.tests[1]!.pins)).toEqual(["check › build"]);
});
