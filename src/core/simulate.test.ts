import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  RULES,
  settleValue,
  simulate as coreSimulate,
  type Event,
  type Scenario,
  type Verdict,
} from "./index";

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

const filtered = (filter: string) => `on:\n  push:\n    ${filter}\n${jobs}`;

test("a push to a branch a branches: filter lists runs, rooted in BR-4 on the matching pattern's line", () => {
  const files = [
    wf("ci.yml", filtered("branches:\n      - main\n      - 'releases/**'")),
  ];
  const { verdicts } = simulate(files, {
    event: { name: "push", ref: "refs/heads/releases/v1" },
    repo: { date },
  });
  expect(verdicts.map((v) => v.key)).toEqual(["ci.yml", "ci.yml › a"]);
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
  expect(verdicts.map((v) => v.key)).toEqual(["ci.yml", "ci.yml › a"]);
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

test("an uncertain GitHub workflow leaves its jobs uncertain, for the same causes", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `on:\n  push:\n    branches: [refs/heads/main]\n${jobs}`)],
    { event: { name: "push", ref: "refs/heads/main" }, repo: { date } },
  );
  expect(verdicts[1]).toEqual({
    key: "ci.yml › a",
    value: "uncertain",
    causes: verdicts[0]!.causes,
    settle: [],
  });
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
    expect(verdicts.map((v) => v.key)).toEqual(["ok.yml", "ok.yml › a"]);
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

test("the example Workflow set on a member's push to main: ci.yml and deploy.yml run through their branch filters, triage.yml is skipped", () => {
  const { verdicts } = simulate(example, {
    event: { name: "push", ref: "main" },
    repo: { date },
  });
  const workflows = verdicts.filter((v) => !v.key.includes(" › "));
  expect(workflows.map((v) => [v.key, v.value, v.causes[0]!.rule])).toEqual([
    ["ci.yml", "runs", "BR-4"],
    ["deploy.yml", "runs", "BR-4"],
    ["triage.yml", "skipped", "EV-0"],
  ]);
});

test("the example Workflow set on a member's pull_request from feature to main: a docs-only change skips ci.yml at its paths: line (PA-2), a src change runs it", () => {
  const pr = (changed: string[]) =>
    simulate(example, {
      event: { name: "pull_request", ref: "feature", base: "main", changed },
      repo: { date },
    }).verdicts.find((v) => v.key === "ci.yml")!;
  const docs = pr(["docs/README.md"]);
  expect(docs.value).toBe("skipped");
  expect(docs.causes[0]).toMatchObject({
    rule: "PA-2",
    spans: [{ path: ".github/workflows/ci.yml", line: 5 }],
    inputs: [{ path: "event.changed", value: ["docs/README.md"] }],
  });
  const src = pr(["src/app.ts"]);
  expect(src.value).toBe("runs");
  expect(src.causes[0]).toMatchObject({ rule: "PA-2", spans: [{ line: 5 }] });
});

const many = (n: number, name = (i: number) => `docs/${i}.md`) =>
  Array.from({ length: n }, (_, i) => name(i));

test.each<[string, string, Event, [string, string, number | undefined]]>([
  // PA-2: paths runs when one changed file matches, rooted at that pattern.
  [
    "a changed file a paths: pattern matches",
    "  push:\n    paths:\n      - 'docs/**'\n      - 'src/**'\n",
    { name: "push", changed: ["README.md", "src/a.ts"] },
    ["runs", "PA-2", 5],
  ],
  [
    "no changed file a paths: pattern matches",
    "  push:\n    paths: ['src/**']\n",
    { name: "push", changed: ["docs/a.md"] },
    ["skipped", "PA-2", 3],
  ],
  [
    "a changed file a later ! pattern excludes",
    "  push:\n    paths: ['src/**', '!src/generated/**']\n",
    { name: "push", changed: ["src/generated/api.ts"] },
    ["skipped", "PA-2", 3],
  ],
  [
    "every changed file paths-ignore matches",
    "  pull_request:\n    paths-ignore: ['docs/**', '*.md']\n",
    { name: "pull_request", changed: ["docs/a.md", "README.md"] },
    ["skipped", "PA-2", 3],
  ],
  [
    "one changed file paths-ignore doesn't match",
    "  pull_request:\n    paths-ignore: ['docs/**']\n",
    { name: "pull_request", changed: ["docs/a.md", "src/a.ts"] },
    ["runs", "PA-2", 3],
  ],
  // PA-7: the whole path from the repository root.
  [
    "a nested file a root-level pattern doesn't match",
    "  push:\n    paths: ['*.md']\n",
    { name: "push", changed: ["docs/a.md"] },
    ["skipped", "PA-2", 3],
  ],
  // PA-3: no changed files, no run.
  [
    "no changed files to paths:",
    "  push:\n    paths: ['src/**']\n",
    { name: "push" },
    ["skipped", "PA-3", 3],
  ],
  [
    "no changed files to paths-ignore:",
    "  pull_request:\n    paths-ignore: ['docs/**']\n",
    { name: "pull_request", changed: [] },
    ["skipped", "PA-3", 3],
  ],
  // BR-6: a branch filter and a path filter must both pass.
  [
    "a branch that passes and paths that don't",
    "  push:\n    branches: [main]\n    paths: ['src/**']\n",
    { name: "push", ref: "main", changed: ["docs/a.md"] },
    ["skipped", "PA-2", 4],
  ],
  [
    "paths that pass and a branch that doesn't",
    "  push:\n    branches: [main]\n    paths: ['src/**']\n",
    { name: "push", ref: "dev", changed: ["src/a.ts"] },
    ["skipped", "BR-4", 3],
  ],
  [
    "a base branch and paths that both pass",
    "  pull_request:\n    branches: [main]\n    paths: ['src/**']\n",
    { name: "pull_request", base: "main", changed: ["src/a.ts"] },
    ["runs", "PA-2", 4],
  ],
  // PA-5: only the first 3,000 changed files are read.
  [
    "a paths: match only after the first 3,000 files",
    "  push:\n    paths: ['src/**']\n",
    { name: "push", changed: [...many(3000), "src/a.ts"] },
    ["skipped", "PA-5", 3],
  ],
  [
    "a paths: match within the first 3,000 files",
    "  push:\n    paths: ['src/**']\n",
    { name: "push", changed: ["src/a.ts", ...many(3000)] },
    ["runs", "PA-2", 3],
  ],
  // PA-6: path filters aren't evaluated for a tag push.
  [
    "a tag push to a tags: filter and paths:",
    "  push:\n    tags: ['v*']\n    paths: ['src/**']\n",
    { name: "push", ref: "refs/tags/v1", changed: ["docs/a.md"] },
    ["runs", "BR-4", 3],
  ],
  [
    "a tag push to paths-ignore: alone",
    "  push:\n    paths-ignore: ['docs/**']\n",
    { name: "push", ref: "refs/tags/v1", changed: ["docs/a.md"] },
    ["runs", "EV-0", 2],
  ],
  // SK-1: a skip instruction in the head commit's message.
  ...[
    "[skip ci]",
    "[ci skip]",
    "[no ci]",
    "[skip actions]",
    "[actions skip]",
  ].map((skip): [string, string, Event, [string, string, number]] => [
    `a push whose message holds ${skip}`,
    "  push:\n",
    { name: "push", message: `Fix typo ${skip}` },
    ["skipped", "SK-1", 2],
  ]),
  [
    "a pull request whose head commit ends in a skip-checks trailer",
    "  pull_request:\n    paths: ['src/**']\n",
    {
      name: "pull_request",
      changed: ["src/a.ts"],
      message: "Fix typo\n\n\nskip-checks: true",
    },
    ["skipped", "SK-1", 2],
  ],
  [
    "a skip-checks trailer after only one empty line",
    "  push:\n",
    { name: "push", message: "Fix typo\n\nskip-checks: true" },
    ["runs", "EV-0", 2],
  ],
  [
    "a message with no skip instruction",
    "  push:\n",
    { name: "push", message: "Skip CI for docs" },
    ["runs", "EV-0", 2],
  ],
])("%s: %j", (_, on, event, expected) => {
  expect(summary(verdictOf(`on:\n${on}`, event))).toEqual(expected);
});

test("a path decision explains the changed files, BR-6, the whole-path rule and the deciding pattern's glob features", () => {
  const v = verdictOf(
    "on:\n  pull_request:\n    branches: [main]\n    paths: ['src/*.ts']\n",
    { name: "pull_request", base: "main", changed: ["src/a.ts"] },
  );
  expect(v.causes.map((c) => c.rule)).toEqual([
    "PA-2",
    "BR-6",
    "PA-7",
    "GL-1",
    "BR-4",
    "BR-2",
    "EV-1",
    "DB-3",
  ]);
  expect(v.causes[0]).toMatchObject({
    spans: [{ line: 4, col: 13 }],
    inputs: [{ path: "event.changed", value: ["src/a.ts"] }],
  });
  const skipped = verdictOf("on:\n  push:\n", {
    name: "push",
    message: "Release [skip ci]",
  });
  expect(skipped.causes[0]).toEqual({
    rule: "SK-1",
    spans: [expect.objectContaining({ line: 2 })],
    inputs: [{ path: "event.message", value: "Release [skip ci]" }],
  });
});

test("paths-ignore with more than 3,000 changed files is uncertain (PA-5), with nothing to settle it", () => {
  const v = verdictOf("on:\n  push:\n    paths-ignore: ['docs/**']\n", {
    name: "push",
    changed: [...many(3000), "src/a.ts"],
  });
  expect(v).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
  });
  expect(summary(v)).toEqual(["uncertain", "PA-5", 3]);
});

test("a tag push to a GitHub workflow with only paths: is uncertain (PA-6), with nothing to settle it and no likeliest reading", () => {
  const v = verdictOf("on:\n  push:\n    paths: ['src/**']\n", {
    name: "push",
    ref: "refs/tags/v1",
    changed: ["src/a.ts"],
  });
  expect(v).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
  });
  expect(summary(v)).toEqual(["uncertain", "PA-6", 3]);
  expect(v.causes[0]!.inputs).toEqual([
    { path: "event.ref", value: "refs/tags/v1" },
  ]);
  expect(RULES["PA-6"]!.text).not.toMatch(/probabl|likel/i);
});

test("a skip instruction decides a GitHub workflow a filter left uncertain", () => {
  const v = verdictOf("on:\n  push:\n    paths: ['src/**']\n", {
    name: "push",
    ref: "refs/tags/v1",
    message: "[skip ci]",
  });
  expect(v.value).toBe("skipped");
  expect(v).not.toHaveProperty("possible");
  expect(v.causes.map((c) => c.rule).slice(0, 2)).toEqual(["SK-1", "PA-6"]);
});

test("paths and paths-ignore on one event is a PA-1 Diagnostic at paths-ignore, and only that file loses its Verdicts", () => {
  const { verdicts, diagnostics } = simulate(
    [
      wf(
        "bad.yml",
        `on:\n  pull_request:\n    paths: ['src/**']\n    paths-ignore: ['docs/**']\n${jobs}`,
      ),
      good,
    ],
    push,
  );
  expect(verdicts.map((v) => v.key)).toEqual(["good.yml", "good.yml › a"]);
  expect(diagnostics).toEqual([
    {
      rule: "PA-1",
      path: ".github/workflows/bad.yml",
      line: 4,
      col: 5,
      endLine: 4,
      endCol: 17,
      message:
        "you may only define one of `paths` and `paths-ignore` for a single event",
    },
  ]);
});

test("a GitHub workflow file over 500 KB is skipped with root PL-9, not a Diagnostic, so it keeps its key", () => {
  const big = `on: push\n${jobs}${"# padding\n".repeat(52_000)}`;
  const { verdicts, diagnostics } = simulate([wf("big.yml", big), good], push);
  expect(diagnostics).toEqual([]);
  expect(verdicts).toEqual([
    {
      key: "big.yml",
      value: "skipped",
      causes: [{ rule: "PL-9", spans: [], inputs: [] }],
    },
    expect.objectContaining({
      key: "big.yml › a",
      value: "no-run",
      causes: [expect.objectContaining({ rule: "PL-9" })],
    }),
    expect.objectContaining({ key: "good.yml", value: "runs" }),
    expect.objectContaining({ key: "good.yml › a" }),
  ]);
  // Just under the limit, it is read.
  const under = `on: push\n${jobs}`.padEnd(500 * 1024, "#");
  expect(
    simulate([wf("big.yml", under)], push).verdicts[0]!.causes[0]!.rule,
  ).toBe("EV-0");
  // The limit counts UTF-8 bytes, not characters.
  expect(
    simulate([wf("big.yml", `${under.slice(0, -1)}é`)], push).verdicts[0]!
      .causes[0]!.rule,
  ).toBe("PL-9");
});

// A member's pull_request touching src: ci.yml runs, and e2e reads the changes job's output.
const memberPr = {
  event: {
    name: "pull_request",
    ref: "feature",
    base: "main",
    changed: ["src/app.ts"],
  },
  repo: { date },
};

test("on the example, ci.yml › e2e waits on dorny/paths-filter's output: Uncertain [runs, skipped], root WN-4 at its if:, settled by the changes job's output", () => {
  const e2e = byKey(simulate(example, memberPr).verdicts, "ci.yml › e2e")!;
  expect(e2e).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: ["ci.yml › changes › outputs.src"],
    hints: [
      {
        path: "ci.yml › changes › outputs.src",
        text: "output `src` of `dorny/paths-filter` in job `changes`",
        candidates: ["true"],
      },
    ],
  });
  expect(e2e.causes[0]).toMatchObject({
    rule: "WN-4",
    spans: [{ path: ".github/workflows/ci.yml", line: 55 }],
  });

  const settled = (value: string) =>
    byKey(
      simulate(example, {
        ...memberPr,
        assume: { "ci.yml › changes › outputs.src": value },
      }).verdicts,
      "ci.yml › e2e",
    )!;
  expect(settled("true")).toEqual({
    key: "ci.yml › e2e",
    value: "runs",
    causes: [expect.objectContaining({ rule: "WN-2" })],
  });
  expect(settled("false")).toMatchObject({ value: "skipped" });
  expect(chainOf([settled("false")], "ci.yml › e2e")).toEqual([["JG-3", 55]]);
});

// gate: id 3, if 4 · after: id 8, needs 9 · report: id 13, needs 14, if 15 · both: id 19, needs 20, if 21
const gated = wf(
  "ci.yml",
  "on: push\njobs:\n" +
    job("gate", "    if: vars.DEPLOY == 'yes'\n") +
    job("after", "    needs: gate\n") +
    job("report", "    needs: gate\n    if: always()\n") +
    job(
      "both",
      "    needs: [gate, after]\n    if: always() && (vars.DEPLOY == 'yes' || vars.FORCE == 'yes')\n",
    ),
);

test("uncertainty spreads only as far as it must: a needs dependent stays Uncertain, an if: always() dependent runs (JG-1), and settle is the union in needs order", () => {
  const { verdicts } = simulate([gated], push);
  expect(byKey(verdicts, "ci.yml › gate")).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: ["vars.DEPLOY"],
    hints: [
      {
        path: "vars.DEPLOY",
        text: "repository variable `DEPLOY`",
        candidates: ["yes"],
      },
    ],
  });
  expect(byKey(verdicts, "ci.yml › after")).toMatchObject({
    value: "uncertain",
    settle: ["vars.DEPLOY"],
  });
  expect(chainOf(verdicts, "ci.yml › after")).toEqual([
    ["WN-4", 4],
    ["JG-1", 9],
  ]);
  // Runs whichever way gate goes: decided, its own root first, gate's cause kept.
  expect(byKey(verdicts, "ci.yml › report")).toMatchObject({ value: "runs" });
  expect(byKey(verdicts, "ci.yml › report")).not.toHaveProperty("settle");
  expect(chainOf(verdicts, "ci.yml › report")).toEqual([
    ["JG-1", 15],
    ["WN-4", 4],
    ["WN-2", 13],
  ]);
  expect(byKey(verdicts, "ci.yml › both")).toMatchObject({
    value: "uncertain",
    settle: ["vars.DEPLOY", "vars.FORCE"],
  });
  expect(byKey(verdicts, "ci.yml › both")!.causes[0]!.rule).toBe("WN-4");

  // A repository variable settles it, matched as GitHub does, ignoring case.
  const set = simulate([gated], {
    ...push,
    repo: { date, vars: { deploy: "yes" } },
  }).verdicts;
  for (const id of ["gate", "after", "report", "both"])
    expect(byKey(set, `ci.yml › ${id}`)).toMatchObject({ value: "runs" });
});

test.each([
  [
    "&& stops at a false left side",
    "github.event_name == 'pull_request' && vars.X == 'y'",
    "skipped",
  ],
  [
    "|| stops at a true left side",
    "github.event_name == 'push' || vars.X == 'y'",
    "runs",
  ],
  ["both branches give the same value", "vars.X == 'y' || true", "runs"],
])(
  "an expression whose outcome never depends on the missing value is decided: %s",
  (_, condition, value) => {
    const { verdicts } = simulate(
      [wf("ci.yml", `on: push\njobs:\n${job("a", `    if: ${condition}\n`)}`)],
      push,
    );
    expect(byKey(verdicts, "ci.yml › a")).toMatchObject({ value });
    expect(byKey(verdicts, "ci.yml › a")).not.toHaveProperty("possible");
  },
);

test("two jobs comparing one variable with different literals are both Uncertain, each offering its own literal", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on: push\njobs:\n" +
          job("a", "    if: vars.ENV == 'staging'\n") +
          job("b", "    if: vars.ENV == 'prod'\n"),
      ),
    ],
    push,
  );
  expect(byKey(verdicts, "ci.yml › a")).toMatchObject({
    value: "uncertain",
    hints: [{ candidates: ["staging", "prod"] }],
  });
  expect(byKey(verdicts, "ci.yml › b")).toMatchObject({ value: "uncertain" });
});

// One job per condition, on a member's pull_request.
const reading = (conditions: Record<string, string>) =>
  wf(
    "pr.yml",
    "on: pull_request\njobs:\n" +
      Object.entries(conditions)
        .map(([id, condition]) => job(id, `    if: ${condition}\n`))
        .join(""),
  );
const pr = { event: { name: "pull_request" }, repo: { date } };
const github = reading({
  repo: "github.repository == 'acme/app'",
  owner: "github.repository_owner == 'acme'",
  actor: "github.actor == 'octocat'",
  labels: "contains(github.event.pull_request.labels.*.name, 'safe to test')",
  draft: "github.event.pull_request.draft == false",
  fork: "github.event.pull_request.head.repo.fork == false",
  base: "github.base_ref == 'main' && github.event_name == 'pull_request'",
  workflow: "github.workflow == 'CI'",
});

test("github.* read from the Event: worked-out fields decide, repository, actor and payload values settle, and other github.* fields exist only at run time", () => {
  const { verdicts } = simulate([github], pr);
  const uncertain = (id: string) => byKey(verdicts, `pr.yml › ${id}`)!;
  expect(uncertain("repo")).toMatchObject({
    value: "uncertain",
    settle: ["repo.repository"],
    // The owner job's literal too: the Settle it box offers only valid owner/repo values.
    hints: [{ candidates: ["acme/app", "acme"] }],
  });
  expect(uncertain("owner")).toMatchObject({ settle: ["repo.repository"] });
  expect(uncertain("actor")).toMatchObject({
    value: "uncertain",
    settle: ["event.login"],
    hints: [{ candidates: ["octocat"] }],
  });
  expect(uncertain("labels")).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: ["github.event.pull_request.labels.*.name"],
    hints: [
      {
        text: "`github.event.pull_request.labels.*.name` on the Event",
        candidates: ["safe to test"],
      },
    ],
  });
  expect(uncertain("draft")).toMatchObject({
    settle: ["github.event.pull_request.draft"],
    hints: [{ candidates: [false] }],
  });
  for (const id of ["fork", "base"])
    expect(uncertain(id)).toMatchObject({ value: "runs" });
  expect(uncertain("workflow")).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
  });
  expect(uncertain("workflow").causes[0]).toMatchObject({
    rule: "WN-4",
    spans: [{ line: 39 }],
  });
  expect(uncertain("workflow")).not.toHaveProperty("hints");

  const settled = simulate([github], {
    event: {
      name: "pull_request",
      login: "octocat",
      payload: { pull_request: { draft: false, labels: [{ name: "x" }] } },
    },
    repo: { date, repository: "acme/app" },
  }).verdicts;
  expect(
    ["repo", "owner", "actor", "labels", "draft"].map(
      (id) => byKey(settled, `pr.yml › ${id}`)!.value,
    ),
  ).toEqual(["runs", "runs", "runs", "skipped", "runs"]);
  // A push has no pull_request, so its fields are empty, not Uncertain.
  expect(
    byKey(
      simulate(
        [
          wf(
            "ci.yml",
            `on: push\njobs:\n${job("a", "    if: github.event.pull_request.draft\n")}`,
          ),
        ],
        push,
      ).verdicts,
      "ci.yml › a",
    ),
  ).toMatchObject({ value: "skipped" });
});

test("settleValue stores each path where it belongs, a .*.<field> path as a list, and refuses paths no Scenario input holds", () => {
  const base = { event: { name: "pull_request" }, repo: { date } };
  const s = [
    ["github.event.pull_request.labels.*.name", ["safe to test", "docs"]],
    ["github.event.pull_request.draft", false],
    ["vars.DEPLOY", "yes"],
    ["ci.yml › changes › outputs.src", "true"],
    ["repo.repository", "acme/app"],
    ["event.login", "octocat"],
  ].reduce<Scenario>(
    (acc, [path, value]) => settleValue(acc, path as string, value),
    base,
  );
  expect(s).toEqual({
    event: {
      name: "pull_request",
      login: "octocat",
      payload: {
        pull_request: {
          labels: [{ name: "safe to test" }, { name: "docs" }],
          draft: false,
        },
      },
    },
    repo: { date, vars: { DEPLOY: "yes" }, repository: "acme/app" },
    assume: { "ci.yml › changes › outputs.src": "true" },
  });
  expect(
    byKey(simulate([github], s).verdicts, "pr.yml › labels"),
  ).toMatchObject({ value: "runs" });
  // On the Follow-up event, for the Verdicts that read run B's Event.
  expect(
    settleValue(
      { ...base, followUp: { name: "pull_request" } },
      "github.event.pull_request.draft",
      true,
      "followUp",
    ).followUp,
  ).toEqual({
    name: "pull_request",
    payload: { pull_request: { draft: true } },
  });

  for (const [path, reason] of [
    ["matrix.os", /matrix/],
    ["steps.filter.outputs.src", /steps/],
    ["hashFiles('**/package-lock.json')", /run time/],
    ["github.event_name", /set it on the Event/],
    ["github.ref", /set it on the Event/],
    ["github.event.action", /set it on the Event/],
    ["github.event.pull_request.head.sha", /set it on the Event/],
    ["github.event.pull_request.head", /set it on the Event/],
    ["github.event.head_commit.message", /set it on the Event/],
    ["github.workflow", /run time/],
    ["github.event.__proto__.x", /refused/],
    ["vars.__proto__.x", /refused/],
  ] as const)
    expect(() => settleValue(base, path, "x"), path).toThrow(reason);
});

test("prototype pollution (#14 §6.7): vars.CONSTRUCTOR, vars.__proto__ and the payload path __proto__.x are ordinary user keys, and nothing reaches Object.prototype", () => {
  const files = [
    reading({
      ctor: "vars.CONSTRUCTOR == 'a'",
      proto: "vars.__proto__ == 'b'",
      payload: "github.event.__proto__.x == 'c'",
    }),
  ];
  const unset = simulate(files, pr).verdicts;
  expect(
    ["ctor", "proto", "payload"].map((id) => byKey(unset, `pr.yml › ${id}`)),
  ).toMatchObject([
    { value: "uncertain", settle: ["vars.CONSTRUCTOR"] },
    { value: "uncertain", settle: ["vars.__proto__"] },
    { value: "uncertain", settle: ["github.event.__proto__.x"] },
  ]);

  // As a link, draft or Test file would bring them in: JSON, where __proto__ is an own key.
  const scenario = JSON.parse(
    `{"event":{"name":"pull_request","payload":{"__proto__":{"x":"c"}}},
      "repo":{"date":"${date}","vars":{"CONSTRUCTOR":"a","__proto__":"b"}}}`,
  ) as Scenario;
  const set = simulate(files, scenario).verdicts;
  for (const id of ["ctor", "proto", "payload"])
    expect(byKey(set, `pr.yml › ${id}`)).toMatchObject({ value: "runs" });
  expect(({} as Record<string, unknown>).x).toBeUndefined();
  expect(Object.getPrototypeOf({})).toBe(Object.prototype);
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
