import { expect, test } from "vitest";
import { RULES, simulate as coreSimulate, type Event } from "./index";

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
  expect(simulate([], push)).toEqual({ verdicts: [], diagnostics: [] });
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
  expect(verdicts).toHaveLength(1);
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
  expect(verdicts).toEqual([
    {
      key: "pr.yml",
      value: "skipped",
      causes: [
        {
          rule: "EV-0",
          spans: [expect.objectContaining({ line: 2 })],
          inputs: [{ path: "event.name", value: "push" }],
        },
      ],
    },
  ]);
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
  expect(verdicts.map((v) => v.key)).toEqual(["a.yml", "z.yaml"]);
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
    ]);
  },
);

test("a 6-level alias bomb is stopped quickly with one Diagnostic on line 1", () => {
  let text = "a0: &a0 [x, x, x, x, x, x, x, x, x, x]\n";
  for (let i = 1; i <= 6; i++)
    text += `a${i}: &a${i} [${Array(10).fill(`*a${i - 1}`).join(", ")}]\n`;
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
  expect(verdicts.map((v) => v.key)).toEqual(["good.yml"]);
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
  expect(verdicts).toEqual([expect.objectContaining({ key: "ci.yml" })]);
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

test("every rule in the catalogue has its text, citation and confidence, and is the root or a cause in a test above", () => {
  for (const rule of Object.values(RULES)) {
    expect(rule.text).not.toBe("");
    expect(rule.url).toMatch(/^https:\/\//);
    expect(["High", "Med", "Low"]).toContain(rule.confidence);
  }
  expect([...seen].sort()).toEqual(Object.keys(RULES).sort());
});
