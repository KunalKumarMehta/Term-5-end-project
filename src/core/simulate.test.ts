import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { RULES, simulate as coreSimulate, type Event } from "./index";

// Every rule ID a test sees, so the last test can check the catalogue is all exercised.
const seen = new Set<string>();
const simulate: typeof coreSimulate = (files, scenario) => {
  const result = coreSimulate(files, scenario);
  for (const v of result.verdicts) for (const c of v.causes) seen.add(c.rule);
  for (const d of result.diagnostics) if (d.rule) seen.add(d.rule);
  return result;
};
// Rules only another ticket's Diagnostic cites: GL-5 is #54's malformed-YAML Diagnostic.
const citedElsewhere = ["GL-5"];

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

const filtered = (filter: string) => `on:\n  push:\n    ${filter}\n${jobs}`;

test("a push to a branch a branches: filter lists runs, rooted in BR-4 on the matching pattern's line", () => {
  const files = [
    wf("ci.yml", filtered("branches:\n      - main\n      - 'releases/**'")),
  ];
  const { verdicts } = simulate(files, {
    event: { name: "push", ref: "refs/heads/releases/v1" },
    repo: { date },
  });
  expect(verdicts).toHaveLength(1);
  expect(verdicts[0]).toMatchObject({ key: "ci.yml", value: "runs" });
  expect(verdicts[0]!.causes[0]).toMatchObject({
    rule: "BR-4",
    spans: [{ line: 5, col: 9 }],
    inputs: [{ path: "event.ref", value: "refs/heads/releases/v1" }],
  });
  expect(verdicts[0]!.causes.map((c) => c.rule)).toEqual([
    "BR-4",
    "BR-3",
    "GL-1",
    "DB-2",
  ]);
});

test("a push to a branch no branches: pattern matches is skipped, rooted in BR-4 on the branches: line", () => {
  const files = [wf("ci.yml", filtered("branches: [main]"))];
  const { verdicts } = simulate(files, {
    event: { name: "push", ref: "feature" },
    repo: { date },
  });
  expect(verdicts[0]).toMatchObject({ key: "ci.yml", value: "skipped" });
  expect(verdicts[0]!.causes[0]).toMatchObject({
    rule: "BR-4",
    spans: [{ line: 3, col: 5 }],
  });
});

// The one GitHub workflow's Verdict for an Event.
function verdictOf(on: string, event: Event) {
  const { verdicts, diagnostics } = simulate([wf("ci.yml", `${on}${jobs}`)], {
    event,
    repo: { date },
  });
  expect(diagnostics).toEqual([]);
  expect(verdicts).toHaveLength(1);
  return verdicts[0]!;
}
// [value, root rule, root line]
const summary = (v: ReturnType<typeof verdictOf>) => [
  v.value,
  v.causes[0]!.rule,
  v.causes[0]!.spans[0]?.line,
];

test.each<[string, string, Event, [string, string, number]]>([
  // push: BR-3, the pushed ref against its own kind's filter.
  [
    "a tag push to a branch-only filter",
    "  push:\n    branches: [main]\n",
    { name: "push", ref: "refs/tags/v1" },
    ["skipped", "BR-3", 3],
  ],
  [
    "a branch push to a tag-only filter",
    "  push:\n    tags: ['v*']\n",
    { name: "push", ref: "refs/heads/main" },
    ["skipped", "BR-3", 3],
  ],
  [
    "a branch push to a tag-ignore-only filter",
    "  push:\n    tags-ignore: [v0]\n",
    { name: "push", ref: "main" },
    ["skipped", "BR-3", 3],
  ],
  [
    "a tag push a tags: pattern matches",
    "  push:\n    branches: [main]\n    tags:\n      - 'v[0-9]+'\n      - '!v0'\n",
    { name: "push", ref: "refs/tags/v12" },
    ["runs", "BR-4", 5],
  ],
  [
    "a tag push a later ! pattern excludes",
    "  push:\n    tags:\n      - 'v[0-9]+'\n      - '!v0'\n",
    { name: "push", ref: "refs/tags/v0" },
    ["skipped", "BR-4", 5],
  ],
  // BR-4: in order, the last match wins.
  [
    "a branch a later positive pattern re-includes",
    "  push:\n    branches:\n      - 'release/**'\n      - '!release/**-alpha'\n      - release/special-alpha\n",
    { name: "push", ref: "release/special-alpha" },
    ["runs", "BR-4", 6],
  ],
  [
    "a branch a ! pattern excludes",
    "  push:\n    branches:\n      - 'release/**'\n      - '!release/**-alpha'\n      - release/special-alpha\n",
    { name: "push", ref: "release/x-alpha" },
    ["skipped", "BR-4", 5],
  ],
  // BR-5: an ignore list skips when any pattern matches.
  [
    "a branch a branches-ignore pattern matches",
    "  push:\n    branches-ignore:\n      - main\n      - 'dependabot/**'\n",
    { name: "push", ref: "refs/heads/dependabot/npm/x" },
    ["skipped", "BR-5", 5],
  ],
  [
    "a branch no branches-ignore pattern matches",
    "  push:\n    branches-ignore: ['dependabot/**']\n",
    { name: "push", ref: "main" },
    ["runs", "BR-5", 3],
  ],
  [
    "a tag a tags-ignore pattern matches",
    "  push:\n    tags-ignore: [v0]\n",
    { name: "push", ref: "refs/tags/v0" },
    ["skipped", "BR-5", 3],
  ],
  // An unset ref is the default branch.
  [
    "no ref, to a default-branch filter",
    "  push:\n    branches: [main]\n",
    { name: "push" },
    ["runs", "BR-4", 3],
  ],
  // pull_request: BR-2, the base branch, never the head ref.
  [
    "a pull request whose base a branches: filter lists",
    "  pull_request:\n    branches: [main]\n",
    { name: "pull_request", ref: "chore", base: "main" },
    ["runs", "BR-4", 3],
  ],
  [
    "a pull request whose base no pattern matches",
    "  pull_request:\n    branches: [main]\n",
    { name: "pull_request", ref: "main", base: "development" },
    ["skipped", "BR-4", 3],
  ],
  [
    "a pull request whose base a branches-ignore pattern matches",
    "  pull_request:\n    branches-ignore: ['docs/**']\n",
    { name: "pull_request", base: "docs/x" },
    ["skipped", "BR-5", 3],
  ],
  [
    "a pull request with no base, to a default-branch filter",
    "  pull_request:\n    branches: [main]\n",
    { name: "pull_request" },
    ["runs", "BR-4", 3],
  ],
  [
    "a pull request to a workflow with only push filters",
    "  push:\n    branches: [main]\n  pull_request:\n",
    { name: "pull_request", base: "dev" },
    ["runs", "EV-0", 4],
  ],
  // EV-1: with no types:, only opened, synchronize and reopened.
  [
    "a pull request with no activity type",
    "  pull_request:\n",
    { name: "pull_request" },
    ["runs", "EV-0", 2],
  ],
  [
    "a synchronize pull request",
    "  pull_request:\n",
    { name: "pull_request", type: "synchronize" },
    ["runs", "EV-0", 2],
  ],
  [
    "a closed pull request with no types:",
    "  pull_request:\n",
    { name: "pull_request", type: "closed" },
    ["skipped", "EV-1", 2],
  ],
  [
    "a labeled pull request types: lists",
    "  pull_request:\n    types: [labeled]\n",
    { name: "pull_request", type: "labeled" },
    ["runs", "EV-0", 2],
  ],
  [
    "a pull request with no activity type, to types: without the defaults",
    "  pull_request:\n    types: [labeled, ready_for_review]\n    branches-ignore: ['docs/**']\n",
    { name: "pull_request" },
    ["skipped", "EV-1", 3],
  ],
  // GL-1..4: the deciding pattern's glob features.
  [
    "a branch matched through + and a range",
    "  push:\n    branches: ['v[12].[0-9]+.[0-9]+']\n",
    { name: "push", ref: "v1.10.1" },
    ["runs", "BR-4", 3],
  ],
  [
    "a branch matched through an escaped !",
    "  push:\n    branches: ['\\!file']\n",
    { name: "push", ref: "!file" },
    ["runs", "BR-4", 3],
  ],
])("%s: %j", (_, on, event, expected) => {
  expect(summary(verdictOf(`on:\n${on}`, event))).toEqual(expected);
});

test("a filter decision explains the input it used, the glob features of the deciding pattern and where the file is read from", () => {
  const push = verdictOf(
    "on:\n  push:\n    branches: ['v[12].[0-9]+.[0-9]+', '!v2*', '\\!x']\n",
    { name: "push", ref: "v1.10.1" },
  );
  expect(push.causes.map((c) => c.rule)).toEqual([
    "BR-4",
    "BR-3",
    "GL-2",
    "GL-3",
    "DB-2",
  ]);
  expect(push.causes[1]).toMatchObject({
    spans: [{ line: 3, col: 5 }],
    inputs: [{ path: "event.ref", value: "v1.10.1" }],
  });
  const excluded = verdictOf("on:\n  push:\n    branches: ['v*', '!v2*']\n", {
    name: "push",
    ref: "v2.0",
  });
  expect(excluded.value).toBe("skipped");
  expect(excluded.causes.map((c) => c.rule)).toEqual([
    "BR-4",
    "BR-3",
    "GL-1",
    "GL-4",
    "DB-2",
  ]);

  const pr = verdictOf(
    "on:\n  pull_request:\n    types: [opened, stacked]\n    branches: [main]\n",
    { name: "pull_request", type: "stacked", base: "main" },
  );
  expect(pr.causes.map((c) => c.rule)).toEqual([
    "BR-4",
    "BR-2",
    "EV-1",
    "EV-4",
    "DB-3",
  ]);
  expect(pr.causes[1]!.inputs).toEqual([{ path: "event.base", value: "main" }]);
  expect(pr.causes[2]).toMatchObject({
    spans: [{ line: 3 }],
    inputs: [{ path: "event.type", value: "stacked" }],
  });

  const unset = verdictOf("on:\n  push:\n    branches: [main]\n", {
    name: "push",
  });
  expect(unset.causes[0]!.inputs).toEqual([
    { path: "repo.defaultBranch", value: "main" },
  ]);
});

test("a full-ref refs/heads/ pattern is uncertain when matching it would flip the outcome (BR-8), with nothing to settle it", () => {
  expect(
    verdictOf("on:\n  push:\n    branches:\n      - refs/heads/main\n", {
      name: "push",
      ref: "refs/heads/main",
    }),
  ).toEqual({
    key: "ci.yml",
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
    causes: [
      {
        rule: "BR-8",
        spans: [expect.objectContaining({ line: 4 })],
        inputs: [{ path: "event.ref", value: "refs/heads/main" }],
      },
      expect.objectContaining({ rule: "BR-3" }),
      expect.objectContaining({ rule: "DB-2" }),
    ],
  });
  // Matched by a short pattern either way: decided.
  expect(
    summary(
      verdictOf("on:\n  push:\n    branches: [main, refs/heads/main]\n", {
        name: "push",
        ref: "main",
      }),
    ),
  ).toEqual(["runs", "BR-4", 3]);
});

test("a pattern that matches only if case doesn't matter is uncertain (GL-6), with nothing to settle it", () => {
  const v = verdictOf("on:\n  pull_request:\n    branches:\n      - Main\n", {
    name: "pull_request",
    base: "main",
  });
  expect(v).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
  });
  expect(summary(v)).toEqual(["uncertain", "GL-6", 4]);
  // Case can't flip it: decided.
  expect(
    summary(
      verdictOf("on:\n  pull_request:\n    branches: [Main, main]\n", {
        name: "pull_request",
        base: "main",
      }),
    ),
  ).toEqual(["runs", "BR-4", 3]);
});

test.each([
  [
    "branches",
    "  push:\n    branches: [main]\n    branches-ignore: [dev]\n",
    4,
  ],
  [
    "tags",
    "  pull_request:\n  push:\n    tags-ignore:\n      - v0\n    tags: ['v*']\n",
    4,
  ],
])(
  "%s and its -ignore on one event is a BR-1 Diagnostic, and only that file loses its Verdicts",
  (kind, on, line) => {
    const { verdicts, diagnostics } = simulate(
      [wf("bad.yml", `on:\n${on}${jobs}`), wf("ok.yml", `on: push\n${jobs}`)],
      { event: { name: "push" }, repo: { date } },
    );
    expect(verdicts.map((v) => v.key)).toEqual(["ok.yml"]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        rule: "BR-1",
        path: ".github/workflows/bad.yml",
        line,
        message: `you may only define one of \`${kind}\` and \`${kind}-ignore\` for a single event`,
      }),
    ]);
  },
);

test("a BR-1 Diagnostic is reported even when the Event is unsupported", () => {
  const { verdicts, diagnostics } = simulate(
    [
      wf(
        "bad.yml",
        `on:\n  pull_request:\n    branches: [a]\n    branches-ignore: [b]\n${jobs}`,
      ),
    ],
    { event: { name: "schedule" }, repo: { date } },
  );
  expect(verdicts.map((v) => v.value)).toEqual(["unsupported"]);
  expect(diagnostics).toEqual([
    expect.objectContaining({ rule: "BR-1", line: 4 }),
  ]);
});

test("an invalid pattern is a Diagnostic at the pattern, and the file gets no Verdicts", () => {
  const { verdicts, diagnostics } = simulate(
    [
      wf(
        "ci.yml",
        `on:\n  push:\n    branches:\n      - main\n      - 'v[]'\n${jobs}`,
      ),
    ],
    push,
  );
  expect(verdicts).toEqual([]);
  expect(diagnostics).toEqual([
    expect.objectContaining({
      path: ".github/workflows/ci.yml",
      line: 5,
      message:
        "invalid Pattern 'v[]': Position: 2 Error: Unexpected empty brackets '[]'",
    }),
  ]);
});

test("an unquoted pattern starting with [ is malformed YAML (GL-5): the file gets no Verdicts", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `on:\n  push:\n    branches:\n      - [a-z]*\n${jobs}`)],
    push,
  );
  expect(verdicts).toEqual([]);
});

test.each<[string, Event]>([
  ["an Event outside v1", { name: "schedule" }],
  [
    "a fork contributor's pull_request, until fork PRs land",
    { name: "pull_request", actor: "fork" },
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

test("the example Workflow set on a member's push to main: ci.yml and deploy.yml run through their branch filters, triage.yml is skipped", () => {
  const { verdicts } = simulate(example, {
    event: { name: "push", ref: "main" },
    repo: { date },
  });
  expect(verdicts.map((v) => [v.key, v.value, v.causes[0]!.rule])).toEqual([
    ["ci.yml", "runs", "BR-4"],
    ["deploy.yml", "runs", "BR-4"],
    ["triage.yml", "skipped", "EV-0"],
  ]);
});

test("every rule in the catalogue has its text, citation and confidence, and is the root or a cause in a test above", () => {
  for (const rule of Object.values(RULES)) {
    expect(rule.text).not.toBe("");
    expect(rule.url).toMatch(/^https:\/\//);
    expect(["High", "Med", "Low"]).toContain(rule.confidence);
  }
  expect([...seen, ...citedElsewhere].sort()).toEqual(
    Object.keys(RULES).sort(),
  );
});
