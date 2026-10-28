import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  RULES,
  simulate as coreSimulate,
  type Event,
  type Verdict,
} from "./index";

// Every rule ID a test sees, so the last test can check the catalogue is all exercised.
const seen = new Set<string>();
const simulate: typeof coreSimulate = (files, scenario) => {
  const result = coreSimulate(files, scenario);
  for (const v of result.verdicts) for (const c of v.causes) seen.add(c.rule);
  return result;
};

const date = "2026-12-03";
const push = { event: { name: "push" }, repo: { date } };
const wf = (name: string, text: string) => ({
  path: `.github/workflows/${name}`,
  text,
});

test("an empty Workflow set gives no Verdicts and no Diagnostics", () => {
  expect(simulate([], push)).toEqual({
    verdicts: [],
    diagnostics: [],
    unmatchedAssumptions: [],
  });
});

test("a GitHub workflow whose on: lists push runs on a push, rooted in EV-0 on the on: line", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "name: CI\non: [push]\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n",
      ),
    ],
    push,
  );
  expect(verdicts[0]).toMatchObject({ key: "ci.yml", value: "runs" });
  expect(verdicts[0]!.causes[0]).toMatchObject({
    rule: "EV-0",
    spans: [{ path: ".github/workflows/ci.yml", line: 2 }],
    inputs: [{ path: "event.name", value: "push" }],
  });
});

const jobs = "jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n";

test("a GitHub workflow whose on: lists only pull_request is skipped on a push, rooted in EV-0 on the on: line", () => {
  const { verdicts } = simulate(
    [wf("pr.yml", `name: PR\non: [pull_request]\n${jobs}`)],
    push,
  );
  expect(verdicts[0]).toEqual({
    key: "pr.yml",
    value: "skipped",
    causes: [
      {
        rule: "EV-0",
        spans: [expect.objectContaining({ line: 2 })],
        inputs: [{ path: "event.name", value: "push" }],
      },
    ],
  });
});

test("an on: entry reached through an alias points at its own line, not its anchor's", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `name: &evt push\n\non: [*evt]\n${jobs}`)],
    push,
  );
  expect(verdicts[0]).toMatchObject({ key: "ci.yml", value: "runs" });
  expect(verdicts[0]!.causes[0]!.spans).toEqual([
    expect.objectContaining({ line: 3, col: 6 }),
  ]);
});

test("only .yml and .yaml files directly in .github/workflows/ load, sorted by subject key", () => {
  const text = `on: push\n${jobs}`;
  const { verdicts } = simulate(
    [
      wf("z.yaml", text),
      wf("a.yml", text),
      wf("nested/b.yml", text),
      wf("notes.md", text),
      { path: "ci.yml", text },
    ],
    push,
  );
  expect(verdicts.map((v) => v.key)).toEqual([
    "a.yml",
    "a.yml › a",
    "z.yaml",
    "z.yaml › a",
  ]);
});

test.each<[string, Event]>([
  ["an Event outside v1", { name: "schedule" }],
  [
    "a member's pull_request, until branch and tag filters land",
    { name: "pull_request" },
  ],
  ["a fork contributor's push", { name: "push", actor: "fork" }],
  ["a dependabot[bot] push", { name: "push", actor: "dependabot" }],
])(
  "%s gives exactly one Verdict: event = unsupported, root WN-3",
  (_, event) => {
    const files = [wf("ci.yml", `on: [push, pull_request]\n${jobs}`)];
    const { verdicts } = simulate(files, { event, repo: { date } });
    expect(verdicts).toEqual([
      {
        key: "event",
        value: "unsupported",
        causes: [expect.objectContaining({ rule: "WN-3", spans: [] })],
      },
    ]);
  },
);

// Job Verdicts (#60)

const job = (id: string, extra = "") =>
  `  ${id}:\n${extra}    runs-on: x\n    steps:\n      - run: echo\n`;
const byKey = (verdicts: Verdict[], key: string) =>
  verdicts.find((v) => v.key === key);

test("a job of a GitHub workflow that runs is keyed <file> › <jobId> and runs, assumed to succeed (WN-2) at its id line", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `on: push\njobs:\n${job("build")}`)],
    push,
  );
  expect(byKey(verdicts, "ci.yml › build")).toEqual({
    key: "ci.yml › build",
    value: "runs",
    causes: [
      {
        rule: "WN-2",
        spans: [expect.objectContaining({ line: 3, col: 3 })],
        inputs: [],
      },
    ],
  });
});

test("a job in a GitHub workflow that didn't run is no-run, with its chain copied from the GitHub workflow", () => {
  const { verdicts } = simulate(
    [wf("pr.yml", `on: pull_request\njobs:\n${job("a")}${job("b")}`)],
    push,
  );
  const file = byKey(verdicts, "pr.yml")!;
  expect(file.value).toBe("skipped");
  for (const key of ["pr.yml › a", "pr.yml › b"])
    expect(byKey(verdicts, key)).toEqual({
      key,
      value: "no-run",
      causes: file.causes,
    });
});

// lint: id line 3, if: line 4 · test: id 8 · docs: id 12, needs 13
// deploy: id 17, needs 18, if 19 · report: id 23, needs 24, if 25
const chain = wf(
  "ci.yml",
  "on: push\njobs:\n" +
    job("lint", "    if: github.ref == 'refs/heads/release'\n") +
    job("test") +
    job("docs", "    needs: lint\n") +
    job("deploy", "    needs: [test]\n    if: github.event_name == 'push'\n") +
    job("report", "    needs: [test, docs]\n    if: always()\n"),
);

// Each cause as [rule, line of its first span].
const chainOf = (verdicts: Verdict[], key: string) =>
  byKey(verdicts, key)!.causes.map((c) => [c.rule, c.spans[0]?.line]);

test("a job skipped by its own if: is skipped with that if: line as its root (JG-3), reading github.* from the Event", () => {
  const { verdicts } = simulate([chain], push);
  expect(byKey(verdicts, "ci.yml › lint")).toMatchObject({ value: "skipped" });
  expect(chainOf(verdicts, "ci.yml › lint")).toEqual([["JG-3", 4]]);
  // github.event_name is push, so deploy's own if: passes.
  expect(byKey(verdicts, "ci.yml › deploy")).toMatchObject({ value: "runs" });
  // On a release push, github.ref matches and lint runs.
  const release = simulate([chain], {
    event: { name: "push", ref: "refs/heads/release" },
    repo: { date },
  });
  expect(byKey(release.verdicts, "ci.yml › lint")).toMatchObject({
    value: "runs",
  });
});

test("a dependent of a skipped job is skipped (JG-1), its root the skipped job's if:", () => {
  const { verdicts } = simulate([chain], push);
  expect(byKey(verdicts, "ci.yml › docs")).toMatchObject({ value: "skipped" });
  expect(chainOf(verdicts, "ci.yml › docs")).toEqual([
    ["JG-3", 4],
    ["JG-1", 13],
  ]);
});

const testFails = {
  ...push,
  assume: { "ci.yml › test": "fails" },
};

test('the Assumption "job X fails" makes X fails (WN-1); a dependent is skipped with root WN-1 through JG-1 and its implicit success() (JG-2)', () => {
  const { verdicts } = simulate([chain], testFails);
  expect(byKey(verdicts, "ci.yml › test")).toEqual({
    key: "ci.yml › test",
    value: "fails",
    causes: [
      {
        rule: "WN-1",
        spans: [expect.objectContaining({ line: 8 })],
        inputs: [{ path: "ci.yml › test", value: "fails" }],
      },
    ],
  });
  expect(byKey(verdicts, "ci.yml › deploy")).toMatchObject({
    value: "skipped",
  });
  expect(chainOf(verdicts, "ci.yml › deploy")).toEqual([
    ["WN-1", 8],
    ["JG-1", 18],
    ["JG-2", 19],
  ]);
});

test("an if: always() dependent of a failed and a skipped job runs, rooted in its if: (JG-1), the upstream causes kept", () => {
  const { verdicts } = simulate([chain], testFails);
  expect(byKey(verdicts, "ci.yml › report")).toMatchObject({ value: "runs" });
  expect(chainOf(verdicts, "ci.yml › report")).toEqual([
    ["JG-1", 25],
    ["WN-1", 8],
    ["WN-2", 23],
  ]);
});

test("needs.<id>.result reads success, failure or skipped", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on: push\njobs:\n" +
          job("a") +
          job("b", "    if: false\n") +
          job(
            "c",
            "    needs: [a, b]\n    if: always() && needs.a.result == 'failure' && needs.b.result == 'skipped'\n",
          ),
      ),
    ],
    { ...push, assume: { "ci.yml › a": "fails" } },
  );
  expect(byKey(verdicts, "ci.yml › c")).toMatchObject({ value: "runs" });
});

test("a dependent of a failing job with job-level continue-on-error: true is Uncertain (JG-11), its settle empty", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on: push\njobs:\n" +
          job("flaky", "    continue-on-error: true\n") +
          job("after", "    needs: flaky\n") +
          job("last", "    needs: after\n") +
          job("cleanup", "    needs: flaky\n    if: always()\n"),
      ),
    ],
    { ...push, assume: { "ci.yml › flaky": "fails" } },
  );
  expect(byKey(verdicts, "ci.yml › flaky")).toMatchObject({ value: "fails" });
  for (const key of ["ci.yml › after", "ci.yml › last"]) {
    expect(byKey(verdicts, key)).toMatchObject({
      value: "uncertain",
      possible: ["runs", "skipped"],
      settle: [],
    });
    expect(chainOf(verdicts, key)[0]).toEqual(["JG-11", 4]);
  }
  // Both readings run it, so it's decided.
  expect(byKey(verdicts, "ci.yml › cleanup")).toMatchObject({
    value: "runs",
  });
});

test("an Assumption naming a job that doesn't exist is reported with candidates", () => {
  const result = simulate([chain], {
    ...push,
    assume: {
      "ci.yml › tset": "fails",
      "ci.yml › test": "fails",
      "old.yml › lint": "fails",
      "ci.yml › test › outputs.src": "true",
    },
  });
  expect(result.unmatchedAssumptions).toEqual([
    {
      key: "ci.yml › tset",
      candidates: [
        "ci.yml › deploy",
        "ci.yml › docs",
        "ci.yml › lint",
        "ci.yml › report",
        "ci.yml › test",
      ],
    },
    { key: "old.yml › lint", candidates: ["ci.yml › lint"] },
  ]);
});

test("an aliased job reports its own line, not its anchor's", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on: push\njobs:\n  a: &skip\n    if: false\n    runs-on: x\n    steps:\n      - run: echo\n\n  b: *skip\n",
      ),
    ],
    push,
  );
  expect(chainOf(verdicts, "ci.yml › a")).toEqual([["JG-3", 4]]);
  expect(chainOf(verdicts, "ci.yml › b")).toEqual([["JG-3", 9]]);
});

const good = wf("good.yml", `on: push\n${jobs}`);

test.each([
  [
    "malformed YAML",
    "on: push\njobs:\n  a:\n    runs-on: [x\n",
    { line: 5, col: 1, message: expect.stringMatching(/^Flow sequence/) },
  ],
  [
    "a schema error",
    `on:\n  push:\n    branchez: [main]\n${jobs}`,
    { line: 3, col: 5, message: "Unexpected value 'branchez'" },
  ],
  [
    "a converter error",
    `on: push\n${jobs}  b:\n    runs-on: x\n    needs: missing\n    steps:\n      - run: echo\n`,
    { line: 9, col: 12, message: "Job 'b' depends on unknown job 'missing'." },
  ],
])(
  "%s is a Diagnostic at its position, and only that file loses its Verdicts",
  (_, text, at) => {
    const { verdicts, diagnostics } = simulate(
      [wf("bad.yml", text), good],
      push,
    );
    expect(diagnostics).toEqual([
      expect.objectContaining({ path: ".github/workflows/bad.yml", ...at }),
    ]);
    expect(verdicts.map((v) => [v.key, v.value])).toEqual([
      ["good.yml", "runs"],
      ["good.yml › a", "runs"],
    ]);
  },
);

test("a 6-level alias bomb is stopped quickly with one Diagnostic on line 1", () => {
  let text = "a0: &a0 [x, x, x, x, x, x, x, x, x, x]\n";
  for (let i = 1; i <= 6; i++)
    text += `a${i}: &a${i} [${Array(10)
      .fill(`*a${i - 1}`)
      .join(", ")}]\n`;
  const start = performance.now();
  const { verdicts, diagnostics } = simulate(
    [wf("ci.yml", `on: push\n${jobs}${text}`), good],
    push,
  );
  expect(performance.now() - start).toBeLessThan(1000);
  expect(diagnostics).toEqual([
    {
      path: ".github/workflows/ci.yml",
      line: 1,
      col: 1,
      endLine: 1,
      endCol: 1,
      message: "Too many YAML aliases: WhyNoRun stopped reading this file",
    },
  ]);
  expect(verdicts.map((v) => v.key)).toEqual(["good.yml", "good.yml › a"]);
});

test("cache-mode and a step's background, which GitHub documents but the bundled schema rejects, are no Diagnostic and keep their Verdicts", () => {
  const { verdicts, diagnostics } = simulate(
    [
      wf(
        "ci.yml",
        `on: push\ncache-mode: read-only\n${jobs}        background: true\n`,
      ),
    ],
    push,
  );
  expect(diagnostics).toEqual([]);
  expect(verdicts.map((v) => v.key)).toEqual(["ci.yml", "ci.yml › a"]);
});

test("Diagnostics are reported for an unsupported Event too, beside its single event Verdict", () => {
  const { verdicts, diagnostics } = simulate(
    [wf("bad.yml", "on: push\njobs: [\n")],
    { event: { name: "schedule" }, repo: { date } },
  );
  expect(verdicts.map((v) => v.key)).toEqual(["event"]);
  expect(diagnostics).toEqual([
    expect.objectContaining({ path: ".github/workflows/bad.yml" }),
  ]);
});

// The bundled example Workflow set behind Load example (#15 §2), byte for byte.
const example = ["ci.yml", "deploy.yml", "triage.yml"].map((name) =>
  wf(
    name,
    readFileSync(
      new URL(`../../playground/src/example/${name}`, import.meta.url),
      "utf8",
    ),
  ),
);

test("the example Workflow set on a member's push to main: ci.yml and deploy.yml run, triage.yml is skipped", () => {
  const { verdicts } = simulate(example, {
    event: { name: "push", ref: "main" },
    repo: { date },
  });
  const workflows = verdicts.filter((v) => !v.key.includes(" › "));
  expect(workflows.map((v) => [v.key, v.value, v.causes[0]!.rule])).toEqual([
    ["ci.yml", "runs", "EV-0"],
    ["deploy.yml", "runs", "EV-0"],
    ["triage.yml", "skipped", "EV-0"],
  ]);
});

test("every rule in the catalogue has its text, citation and confidence, and is the root or a cause in a test above", () => {
  for (const rule of Object.values(RULES)) {
    expect(rule.text).not.toBe("");
    expect(rule.url).toMatch(/^https:\/\//);
    expect(["High", "Med", "Low"]).toContain(rule.confidence);
  }
  expect([...seen].sort()).toEqual(Object.keys(RULES).sort());
});
