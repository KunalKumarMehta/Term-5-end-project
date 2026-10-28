import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  RULES,
  settleValue,
  simulate as coreSimulate,
  withDefaults,
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
// The GitHub workflow and job Verdicts, leaving out access keys, for tests not about access.
const runVerdicts = (verdicts: Verdict[]) =>
  verdicts.filter((v) => !/ › (token\.[a-z-]+|secrets)$/.test(v.key));
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
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
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
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
    "ci.yml",
    "ci.yml › a",
  ]);
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
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
    "ci.yml",
    "ci.yml › a",
  ]);
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
    possible: ["no-run", "runs"],
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
    expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
      "ok.yml",
      "ok.yml › a",
    ]);
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
  expect(runVerdicts(verdicts).map((v) => v.value)).toEqual(["unsupported"]);
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
  ["a fork contributor's push", { name: "push", actor: "fork" }],
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

test("a private repo with a fork contributor gives exactly one Verdict: event = unsupported, root WN-3, naming the visibility", () => {
  const files = [wf("ci.yml", `on: [push, pull_request]\n${jobs}`)];
  const { verdicts } = simulate(files, {
    event: { name: "pull_request", actor: "fork" },
    repo: { date, visibility: "private" },
  });
  expect(verdicts).toEqual([
    {
      key: "event",
      value: "unsupported",
      causes: [
        {
          rule: "WN-3",
          spans: [],
          inputs: [
            { path: "event.name", value: "pull_request" },
            { path: "event.actor", value: "fork" },
            { path: "repo.visibility", value: "private" },
          ],
        },
      ],
    },
  ]);
});

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
    expect(runVerdicts(verdicts).map((v) => [v.key, v.value])).toEqual([
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
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
    "good.yml",
    "good.yml › a",
  ]);
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
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
    "ci.yml",
    "ci.yml › a",
  ]);
});

test("Diagnostics are reported for an unsupported Event too, beside its single event Verdict", () => {
  const { verdicts, diagnostics } = simulate(
    [wf("bad.yml", "on: push\njobs: [\n")],
    { event: { name: "schedule" }, repo: { date } },
  );
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual(["event"]);
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
  expect(runVerdicts(verdicts).map((v) => v.key)).toEqual([
    "good.yml",
    "good.yml › a",
  ]);
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
  expect(runVerdicts(verdicts)).toEqual([
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

// Access keys (#62): 17 token scopes (no `metadata`) and secrets per job with steps.
const SCOPES = [
  "actions",
  "artifact-metadata",
  "attestations",
  "checks",
  "code-quality",
  "contents",
  "copilot-requests",
  "deployments",
  "discussions",
  "id-token",
  "issues",
  "packages",
  "pages",
  "pull-requests",
  "security-events",
  "statuses",
  "vulnerability-alerts",
];
/** A job's access Verdicts by subject (`token.<scope>` or `secrets`). */
const accessOf = (verdicts: Verdict[], job: string) =>
  Object.fromEntries(
    verdicts
      .filter((v) => v.key.startsWith(`${job} › `))
      .map((v) => [v.key.slice(job.length + 3), v]),
  );
const levels = (access: Record<string, Verdict>) =>
  Object.fromEntries(
    Object.entries(access).map(([k, v]) => [k, v.possible ?? v.value]),
  );
const allScopes = (level: string, except: Record<string, unknown> = {}) => ({
  ...Object.fromEntries(SCOPES.map((s) => [`token.${s}`, level])),
  ...except,
});

test("the example set on a member's pull_request touching src: ci.yml › test gets pull-requests write and contents read from its permissions: block, its other 15 scopes none, and secrets available (FK-0)", () => {
  const { verdicts } = simulate(example, {
    event: {
      name: "pull_request",
      ref: "feature",
      base: "main",
      changed: ["src/app.ts"],
    },
    repo: { date },
  });
  const access = accessOf(verdicts, "ci.yml › test");
  expect(levels(access)).toEqual(
    allScopes("none", {
      "token.contents": "read",
      "token.pull-requests": "write",
      secrets: "available",
    }),
  );
  expect(access["token.pull-requests"]!.causes[0]).toEqual({
    rule: "PERM-3",
    spans: [
      {
        path: ".github/workflows/ci.yml",
        line: 44,
        col: 7,
        endLine: 44,
        endCol: 27,
      },
    ],
    inputs: [],
  });
  expect(access["token.contents"]!.causes[0]).toMatchObject({
    rule: "PERM-3",
    spans: [{ line: 43 }],
  });
  // An unlisted scope is none, at the permissions: line (PERM-3).
  expect(access["token.issues"]!.causes[0]).toMatchObject({
    rule: "PERM-3",
    spans: [{ line: 42 }],
  });
  expect(access.secrets!.causes[0]).toEqual({
    rule: "FK-0",
    spans: [],
    inputs: [{ path: "event.actor", value: "member" }],
  });
});

test("the example set on a push to main: deploy.yml › deploy gets contents write from the workflow-level block, and secrets available", () => {
  const { verdicts } = simulate(example, {
    event: { name: "push", ref: "main" },
    repo: { date },
  });
  const access = accessOf(verdicts, "deploy.yml › deploy");
  expect(levels(access)).toEqual(
    allScopes("none", { "token.contents": "write", secrets: "available" }),
  );
  expect(access["token.contents"]!.causes).toEqual([
    {
      rule: "PERM-3",
      spans: [expect.objectContaining({ line: 10, col: 3, endCol: 18 })],
      inputs: [],
    },
  ]);
  expect(access.secrets!.value).toBe("available");
});

const steps = "    runs-on: x\n    steps:\n      - run: echo\n";

test("a job-level permissions: block replaces the workflow-level one (PERM-4), and its unlisted scopes are none (PERM-3)", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        `on: push\npermissions: write-all\njobs:\n  a:\n    permissions:\n      issues: write\n${steps}  b:\n${steps}`,
      ),
    ],
    push,
  );
  const a = accessOf(verdicts, "ci.yml › a");
  expect(levels(a)).toEqual(
    allScopes("none", { "token.issues": "write", secrets: "available" }),
  );
  expect(a["token.contents"]!.causes).toEqual([
    {
      rule: "PERM-3",
      spans: [expect.objectContaining({ line: 5, col: 5 })],
      inputs: [],
    },
    {
      rule: "PERM-4",
      spans: [expect.objectContaining({ line: 2, col: 1 })],
      inputs: [],
    },
  ]);
  // b has no block of its own, so write-all applies; vulnerability-alerts can hold only read (PERM-5).
  const b = accessOf(verdicts, "ci.yml › b");
  expect(levels(b)).toEqual(
    allScopes("write", {
      "token.vulnerability-alerts": "read",
      secrets: "available",
    }),
  );
  expect(b["token.vulnerability-alerts"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-3",
    "PERM-5",
  ]);
});

test("read-all gives every scope read, except id-token and copilot-requests, which can hold only write or none (PERM-5)", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `on: push\npermissions: read-all\njobs:\n  a:\n${steps}`)],
    push,
  );
  const a = accessOf(verdicts, "ci.yml › a");
  expect(levels(a)).toEqual(
    allScopes("read", {
      "token.id-token": "none",
      "token.copilot-requests": "none",
      secrets: "available",
    }),
  );
  expect(a["token.id-token"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-3",
    "PERM-5",
  ]);
  // {} sets every scope to none.
  const empty = simulate(
    [wf("ci.yml", `on: push\npermissions: {}\njobs:\n  a:\n${steps}`)],
    push,
  ).verdicts;
  expect(levels(accessOf(empty, "ci.yml › a"))).toEqual(
    allScopes("none", { secrets: "available" }),
  );
});

test("a job skipped by its own if: still gets all 17 token keys and its secrets key, computed as if it runs (ADR 0001)", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `on: push\njobs:\n  a:\n    if: false\n${steps}`)],
    push,
  );
  expect(verdicts.find((v) => v.key === "ci.yml › a")!.value).toBe("skipped");
  const a = accessOf(verdicts, "ci.yml › a");
  expect(Object.keys(a).sort()).toEqual(
    [...SCOPES.map((s) => `token.${s}`), "secrets"].sort(),
  );
  // No permissions: anywhere, so the restricted token default reads contents and packages (PERM-1).
  expect(levels(a)).toEqual(
    allScopes("none", {
      "token.contents": "read",
      "token.packages": "read",
      secrets: "available",
    }),
  );
  expect(a["token.contents"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-1",
    "WN-5",
  ]);
});

test("a job with environment: is computed normally, and its secrets Explanation notes the environment (PL-16) and that RU-3 isn't modelled", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        `on: push\njobs:\n  a:\n    environment: production\n${steps}`,
      ),
    ],
    push,
  );
  expect(verdicts.find((v) => v.key === "ci.yml › a")!.value).toBe("runs");
  const { secrets } = accessOf(verdicts, "ci.yml › a");
  expect(secrets!.value).toBe("available");
  expect(secrets!.causes.map((c) => c.rule)).toEqual(["FK-0", "PL-16"]);
  expect(secrets!.causes[1]!.spans).toEqual([
    expect.objectContaining({ line: 4, col: 5 }),
  ]);
  expect(RULES["PL-16"]!.text).toContain("RU-3");
});

test("with a permissive token default, a job with no permissions: gets id-token and copilot-requests Uncertain [none, write] with an empty settle (PERM-8)", () => {
  const { verdicts } = simulate(
    [wf("ci.yml", `on: push\njobs:\n  a:\n${steps}`)],
    { event: { name: "push" }, repo: { date, tokenDefault: "permissive" } },
  );
  const a = accessOf(verdicts, "ci.yml › a");
  expect(levels(a)).toEqual(
    allScopes("write", {
      "token.id-token": ["none", "write"],
      "token.copilot-requests": ["none", "write"],
      "token.vulnerability-alerts": "read",
      secrets: "available",
    }),
  );
  expect(a["token.id-token"]).toEqual({
    key: "ci.yml › a › token.id-token",
    value: "uncertain",
    causes: [
      { rule: "PERM-8", spans: [], inputs: [] },
      {
        rule: "PERM-1",
        spans: [],
        inputs: [{ path: "repo.tokenDefault", value: "permissive" }],
      },
    ],
    possible: ["none", "write"],
    settle: [],
  });
});

const wn5 = (path: string, value: unknown) => ({
  rule: "WN-5",
  spans: [],
  inputs: [{ path, value }],
});

test("a job with no permissions: takes its scopes from the assumed token default: root PERM-1, then a WN-5 cause; setting the token default to that value drops WN-5 and keeps the root", () => {
  const files = [wf("ci.yml", `on: push\njobs:\n  a:\n${steps}`)];
  const perm1 = {
    rule: "PERM-1",
    spans: [],
    inputs: [{ path: "repo.tokenDefault", value: "restricted" }],
  };
  const assumed = accessOf(simulate(files, push).verdicts, "ci.yml › a");
  expect(assumed["token.contents"]).toMatchObject({
    value: "read",
    causes: [perm1, wn5("repo.tokenDefault", "restricted")],
  });
  expect(assumed["token.actions"]).toMatchObject({
    value: "none",
    causes: [perm1, wn5("repo.tokenDefault", "restricted")],
  });
  // The token default doesn't decide secrets, so no WN-5 there.
  expect(assumed.secrets!.causes.map((c) => c.rule)).toEqual(["FK-0"]);

  const set = accessOf(
    simulate(files, {
      event: { name: "push" },
      repo: { date, tokenDefault: "restricted" },
    }).verdicts,
    "ci.yml › a",
  );
  expect(set["token.contents"]).toMatchObject({
    value: "read",
    causes: [perm1],
  });
});

test("a job with its own permissions: block isn't decided by the token default, so it gets no WN-5 cause", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        `on: push\njobs:\n  a:\n    permissions:\n      contents: write\n${steps}`,
      ),
    ],
    push,
  );
  const a = accessOf(verdicts, "ci.yml › a");
  expect(a["token.contents"]!.causes.map((c) => c.rule)).toEqual(["PERM-3"]);
});

test("a pinned root survives writing the defaults out: every Verdict keeps its value and root, and only the WN-5 causes go", () => {
  const scenario = {
    event: {
      name: "pull_request",
      actor: "member" as const,
      ref: "feature",
      base: "main",
      changed: ["src/app.ts"],
    },
    repo: { date },
  };
  // The example set, plus a GitHub workflow with no permissions: anywhere (PERM-1).
  const files = [
    ...example,
    wf("lint.yml", `on: pull_request\njobs:\n  lint:\n${steps}`),
  ];
  const assumed = simulate(files, scenario).verdicts;
  const written = simulate(files, withDefaults(scenario).scenario).verdicts;
  expect(assumed.some((v) => v.causes.some((c) => c.rule === "WN-5"))).toBe(
    true,
  );
  expect(written.map((v) => [v.key, v.value, v.causes[0]!.rule])).toEqual(
    assumed.map((v) => [v.key, v.value, v.causes[0]!.rule]),
  );
  for (const v of assumed) expect(v.causes[0]!.rule).not.toBe("WN-5");
  expect(written).toEqual(
    assumed.map((v) => ({
      ...v,
      causes: v.causes.filter((c) => c.rule !== "WN-5"),
    })),
  );
});

// Reusable workflows (#66): local callees one level deep, remote callers never fetched.
const lib = (extra = "") =>
  `on:\n  workflow_call:${extra}\njobs:\n  publish:\n${steps}`;
const caller = (uses: string, extra = "") =>
  `on: push\njobs:\n  build:\n${steps}  deploy:\n${extra}    uses: ${uses}\n`;

test("a local uses: into a subfolder of .github/workflows is a Diagnostic (PL-0) on the uses: line, and the caller gets no Verdicts", () => {
  const { verdicts, diagnostics } = simulate(
    [wf("ci.yml", caller("./.github/workflows/lib/x.yml"))],
    push,
  );
  expect(verdicts).toEqual([]);
  expect(diagnostics).toEqual([
    expect.objectContaining({
      path: ".github/workflows/ci.yml",
      line: 8,
      rule: "PL-0",
      message:
        "`.github/workflows/lib/x.yml` isn't directly in `.github/workflows/`, the only place GitHub reads a called workflow from.",
    }),
  ]);
});

test("a local uses: to a file that isn't in the Workflow set is a Diagnostic (RU-4) on the uses: line, and even the independent jobs get no Verdicts", () => {
  const { verdicts, diagnostics } = simulate(
    [wf("ci.yml", caller("./.github/workflows/release.yml"))],
    push,
  );
  expect(verdicts).toEqual([]);
  expect(diagnostics).toEqual([
    expect.objectContaining({
      path: ".github/workflows/ci.yml",
      line: 8,
      rule: "RU-4",
      message:
        "`.github/workflows/release.yml` isn't in the Workflow set. Paste or upload it.",
    }),
  ]);
});

test("every direct local caller of a local callee with Diagnostics gets an RU-4 Diagnostic on its uses: line, and it never cascades past depth 1", () => {
  const { verdicts, diagnostics } = simulate(
    [
      wf("ci.yml", caller("./.github/workflows/release.yml")),
      wf("nightly.yml", caller("$/.github/workflows/release.yml")),
      // release.yml calls a missing file, so it has a Diagnostic of its own.
      wf(
        "release.yml",
        "on: workflow_call\njobs:\n  inner:\n    uses: ./.github/workflows/gone.yml\n",
      ),
      // top.yml calls ci.yml, whose Diagnostic comes only from its callee.
      wf(
        "top.yml",
        "on: push\njobs:\n  ci:\n    uses: ./.github/workflows/ci.yml\n",
      ),
    ],
    push,
  );
  const message =
    "Called workflow `.github/workflows/release.yml` has Diagnostics; fix them to simulate this file.";
  expect(diagnostics).toEqual([
    expect.objectContaining({
      path: ".github/workflows/ci.yml",
      line: 8,
      rule: "RU-4",
      message,
    }),
    expect.objectContaining({
      path: ".github/workflows/nightly.yml",
      line: 8,
      rule: "RU-4",
      message,
    }),
    expect.objectContaining({
      path: ".github/workflows/release.yml",
      line: 4,
      rule: "RU-4",
    }),
  ]);
  expect(verdicts.map((v) => v.key)).toContain("top.yml › ci");
});

// Actor kinds (#64): fork contributors and dependabot[bot].
const actorPr = (actor: "member" | "fork" | "dependabot", extra = {}) => ({
  event: {
    name: "pull_request",
    actor,
    ref: "feature",
    base: "main",
    changed: ["src/app.ts"],
    ...extra,
  },
  repo: { date },
});

const callerSet = [
  wf(
    "ci.yml",
    "on: [push, pull_request]\npermissions:\n  contents: write\n  id-token: write\njobs:\n" +
      `  build:\n${steps}` +
      "  deploy:\n    permissions:\n      contents: read\n      id-token: write\n    secrets: inherit\n    uses: ./.github/workflows/lib.yml\n" +
      "  plain:\n    uses: ./.github/workflows/lib.yml\n",
  ),
  wf(
    "lib.yml",
    "on:\n  workflow_call:\npermissions:\n  contents: write\n  pull-requests: write\njobs:\n" +
      `  publish:\n${steps}`,
  ),
];

test("a local uses: caller gets only its run key; its callee's jobs are keyed <callerFile> › <callerJob>/<calleeJob>, capped by the caller's permissions: (PERM-7) and given only the secrets it passes (RU-1); the workflow_call-only file gets no keys of its own", () => {
  const { verdicts, diagnostics } = simulate(callerSet, push);
  expect(diagnostics).toEqual([]);
  expect(runVerdicts(verdicts).map((v) => [v.key, v.value])).toEqual([
    ["ci.yml", "runs"],
    ["ci.yml › build", "runs"],
    ["ci.yml › deploy", "runs"],
    ["ci.yml › deploy/publish", "runs"],
    ["ci.yml › plain", "runs"],
    ["ci.yml › plain/publish", "runs"],
  ]);
  expect(accessOf(verdicts, "ci.yml › deploy")).toEqual({});
  expect(verdicts.some((v) => v.key.startsWith("lib.yml"))).toBe(false);

  // deploy's own block caps the callee: contents write → read, pull-requests write → none.
  const deploy = accessOf(verdicts, "ci.yml › deploy/publish");
  expect(levels(deploy)).toEqual(
    allScopes("none", { "token.contents": "read", secrets: "available" }),
  );
  expect(deploy["token.contents"]!.causes[0]).toEqual({
    rule: "PERM-7",
    spans: [
      expect.objectContaining({ path: ".github/workflows/ci.yml", line: 11 }),
    ],
    inputs: [],
  });
  expect(deploy["token.pull-requests"]!.causes[0]!.rule).toBe("PERM-7");
  // The callee's block doesn't list id-token, so the cap doesn't decide it.
  expect(deploy["token.id-token"]!.causes[0]!.rule).toBe("PERM-3");
  expect(deploy.secrets!.causes.map((c) => c.rule)).toEqual(["RU-1", "FK-0"]);
  expect(deploy.secrets!.causes[0]!.spans).toEqual([
    expect.objectContaining({ line: 14 }),
  ]);

  // plain sets no block, so the caller's workflow-level one caps it; it passes no secrets.
  const plain = accessOf(verdicts, "ci.yml › plain/publish");
  expect(levels(plain)).toEqual(
    allScopes("none", { "token.contents": "write", secrets: "empty" }),
  );
  expect(plain["token.pull-requests"]!.causes[0]).toMatchObject({
    rule: "PERM-7",
    spans: [expect.objectContaining({ line: 2 })],
  });
  expect(plain.secrets!.causes).toEqual([
    {
      rule: "RU-1",
      spans: [expect.objectContaining({ line: 17 })],
      inputs: [],
    },
  ]);
});

test("a callee with no permissions: of its own takes the caller's levels (PERM-7)", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on: push\njobs:\n  deploy:\n    permissions:\n      issues: write\n    uses: ./.github/workflows/lib.yml\n",
      ),
      wf("lib.yml", lib()),
    ],
    push,
  );
  const publish = accessOf(verdicts, "ci.yml › deploy/publish");
  expect(levels(publish)).toEqual(
    allScopes("none", { "token.issues": "write", secrets: "empty" }),
  );
  expect(publish["token.issues"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-3",
    "PERM-7",
  ]);
});

test.each([
  ["fork", "empty", "FK-2"],
  ["dependabot", "dependabot-only", "FK-8"],
] as const)(
  "a %s caller passes its callee only what its own run has (RU-1a): %s",
  (actor, value, rule) => {
    const { verdicts } = simulate(callerSet, actorPr(actor));
    const secrets = byKey(verdicts, "ci.yml › deploy/publish › secrets")!;
    expect(secrets.value).toBe(value);
    expect(secrets.causes.map((c) => c.rule)).toEqual(["RU-1a", rule, "RU-1"]);
  },
);

test("a callee job whose caller job is skipped by its if: is no-run, with its chain copied from the caller job", () => {
  const { verdicts } = simulate(
    [
      wf("ci.yml", caller("./.github/workflows/lib.yml", "    if: false\n")),
      wf("lib.yml", lib()),
    ],
    push,
  );
  const deploy = byKey(verdicts, "ci.yml › deploy")!;
  expect(deploy).toMatchObject({ value: "skipped" });
  expect(deploy.causes[0]!.rule).toBe("JG-3");
  expect(byKey(verdicts, "ci.yml › deploy/publish")).toEqual({
    key: "ci.yml › deploy/publish",
    value: "no-run",
    causes: deploy.causes,
  });
});

test("a callee job's if: reads inputs.* from its caller job's with:, then the callee's declared defaults; a with: value WhyNoRun can't work out is Uncertain (WN-4)", () => {
  const callee = wf(
    "lib.yml",
    "on:\n  workflow_call:\n    inputs:\n      go:\n        type: boolean\n" +
      "      env:\n        type: string\n        default: staging\n" +
      "      n:\n        type: number\n        default: 4\njobs:\n" +
      job("publish", "    if: inputs.go\n") +
      job("stage", "    if: inputs.env == 'staging'\n") +
      job("four", "    if: inputs.n == 4\n"),
  );
  const run = (withs: string) =>
    runVerdicts(
      simulate(
        [
          wf(
            "ci.yml",
            caller(
              "./.github/workflows/lib.yml",
              withs && `    with:\n${withs}`,
            ),
          ),
          callee,
        ],
        push,
      ).verdicts,
    ).filter((v) => v.key.includes("/"));
  const values = (verdicts: Verdict[]) =>
    verdicts.map((v) => [v.key.split("/")[1], v.value]);

  expect(values(run("      go: true\n"))).toEqual([
    ["four", "runs"],
    ["publish", "runs"],
    ["stage", "runs"],
  ]);
  // No with: a boolean input with no default is false.
  expect(values(run(""))).toEqual([
    ["four", "runs"],
    ["publish", "skipped"],
    ["stage", "runs"],
  ]);
  expect(
    values(
      run("      go: ${{ github.event_name == 'push' }}\n      env: prod\n"),
    ),
  ).toEqual([
    ["four", "runs"],
    ["publish", "runs"],
    ["stage", "skipped"],
  ]);

  // A repository variable settles it; a caller job's needs output doesn't exist before the run.
  const vars = run("      env: ${{ vars.ENV }}\n");
  expect(byKey(vars, "ci.yml › deploy/stage")).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: ["vars.ENV"],
  });
  const needs = run("      go: ${{ needs.build.outputs.go }}\n");
  const publish = byKey(needs, "ci.yml › deploy/publish")!;
  expect(publish).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
  });
  expect(publish.causes[0]!.rule).toBe("WN-4");
});

test.each([
  [
    "passes a secret the callee doesn't declare",
    "\n    secrets:\n      token:",
    "    secrets:\n      token: x\n      extra: y\n",
  ],
  [
    "leaves out one the callee declares required: true",
    "\n    secrets:\n      token:\n        required: true",
    "",
  ],
])(
  "a caller that %s makes its GitHub workflow fail (root RU-2) and its jobs no-run",
  (_, declared, passed) => {
    const { verdicts, diagnostics } = simulate(
      [
        wf("ci.yml", caller("./.github/workflows/lib.yml", passed)),
        wf("lib.yml", lib(declared)),
      ],
      push,
    );
    expect(diagnostics).toEqual([]);
    const workflow = byKey(verdicts, "ci.yml")!;
    expect(workflow.value).toBe("fails");
    expect(workflow.causes[0]).toEqual({
      rule: "RU-2",
      spans: [expect.objectContaining({ line: passed ? 11 : 8 })],
      inputs: [],
    });
    expect(RULES["RU-2"]!.text).toMatch(/don't say whether/);
    expect(
      runVerdicts(verdicts)
        .slice(1)
        .map((v) => [v.key, v.value, v.causes[0]!.rule]),
    ).toEqual([
      ["ci.yml › build", "no-run", "RU-2"],
      ["ci.yml › deploy", "no-run", "RU-2"],
      ["ci.yml › deploy/publish", "no-run", "RU-2"],
    ]);
  },
);

test("a secrets: mapping that matches the callee's declarations, ignoring case, lets the run go ahead", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        caller("./.github/workflows/lib.yml", "    secrets:\n      TOKEN: x\n"),
      ),
      wf(
        "lib.yml",
        lib("\n    secrets:\n      token:\n        required: true"),
      ),
    ],
    push,
  );
  expect(byKey(verdicts, "ci.yml")!.value).toBe("runs");
  expect(byKey(verdicts, "ci.yml › deploy/publish › secrets")!.value).toBe(
    "available",
  );
});

const remoteSet = [
  wf(
    "ci.yml",
    "on: [push, pull_request]\njobs:\n" +
      "  none:\n    permissions:\n      id-token: write\n      contents: read\n    uses: octo/lib/.github/workflows/x.yml@v1\n" +
      "  mapped:\n    secrets:\n      TOKEN: ${{ secrets.TOKEN }}\n    uses: octo/lib/.github/workflows/x.yml@v1\n" +
      "  inherit:\n    secrets: inherit\n    uses: Octo/lib/.github/workflows/x.yml@v1\n",
  ),
];

test("a remote caller gets its run key, citing WN-2 on it and on its GitHub workflow, decided secrets, and 17 token keys Uncertain at or below its cap (WN-6)", () => {
  const { verdicts } = simulate(remoteSet, push);
  const rules = byKey(verdicts, "ci.yml")!.causes.map((c) => c.rule);
  expect(rules[0]).toBe("EV-0");
  expect(rules.slice(-3)).toEqual(["WN-2", "WN-2", "WN-2"]);
  expect(byKey(verdicts, "ci.yml › none")).toMatchObject({ value: "runs" });
  expect(byKey(verdicts, "ci.yml › none")!.causes.at(-1)!.rule).toBe("WN-2");
  expect(verdicts.some((v) => v.key.startsWith("ci.yml › none/"))).toBe(false);

  const none = accessOf(verdicts, "ci.yml › none");
  expect(levels(none)).toEqual(
    allScopes("none", {
      "token.contents": ["none", "read"],
      "token.id-token": ["none", "write"],
      secrets: "empty",
    }),
  );
  expect(none["token.id-token"]).toEqual({
    key: "ci.yml › none › token.id-token",
    value: "uncertain",
    causes: [
      expect.objectContaining({ rule: "WN-6" }),
      expect.objectContaining({ rule: "PERM-7" }),
      expect.objectContaining({ rule: "PERM-3" }),
    ],
    possible: ["none", "write"],
    settle: [],
  });
  // A cap of none decides the scope.
  expect(none["token.issues"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-3",
    "PERM-7",
    "WN-6",
  ]);
  expect(none.secrets!.causes.map((c) => c.rule)).toEqual(["RU-1", "WN-6"]);

  const mapped = byKey(verdicts, "ci.yml › mapped › secrets")!;
  expect(mapped.value).toBe("available");
  // The Explanation shows the mapping's lines, which list the names passed.
  expect(mapped.causes[0]).toMatchObject({
    rule: "RU-1",
    spans: [expect.objectContaining({ line: 10, endLine: 11 })],
  });
});

test("a remote caller's secrets: inherit is decided only when the callee's owner is the repo's; otherwise it is Uncertain with nothing to settle it", () => {
  const unset = byKey(
    simulate(remoteSet, push).verdicts,
    "ci.yml › inherit › secrets",
  );
  expect(unset).toMatchObject({
    value: "uncertain",
    possible: ["available", "empty"],
    settle: [],
  });
  expect(unset!.causes[0]!.rule).toBe("WN-6");
  const other = simulate(remoteSet, {
    ...push,
    repo: { date, repository: "acme/app" },
  }).verdicts;
  expect(byKey(other, "ci.yml › inherit › secrets")!.value).toBe("uncertain");

  const same = byKey(
    simulate(remoteSet, { ...push, repo: { date, repository: "octo/app" } })
      .verdicts,
    "ci.yml › inherit › secrets",
  )!;
  expect(same.value).toBe("available");
  expect(same.causes[0]).toMatchObject({
    rule: "RU-1",
    inputs: [{ path: "repo.repository", value: "octo/app" }],
  });
  // A fork's run has nothing to pass, so inherit is decided whoever owns the callee.
  expect(
    byKey(
      simulate(remoteSet, actorPr("fork")).verdicts,
      "ci.yml › inherit › secrets",
    )!.value,
  ).toBe("empty");
});

test("the example's Fork PR: ci.yml › test gets pull-requests downgraded to read (root PERM-2 at its line, then PERM-6) and secrets empty (FK-2); a Member PR gets write and available (FK-0)", () => {
  const fork = accessOf(
    simulate(example, actorPr("fork")).verdicts,
    "ci.yml › test",
  );
  expect(levels(fork)).toEqual(
    allScopes("none", {
      "token.contents": "read",
      "token.pull-requests": "read",
      secrets: "empty",
    }),
  );
  expect(fork["token.pull-requests"]!.causes).toEqual([
    {
      rule: "PERM-2",
      spans: [expect.objectContaining({ line: 44 })],
      inputs: [{ path: "event.actor", value: "fork" }],
    },
    { rule: "PERM-6", spans: [], inputs: [] },
    expect.objectContaining({
      rule: "PERM-3",
      spans: [expect.objectContaining({ line: 44 })],
    }),
    // The job's block replaces the workflow's.
    expect.objectContaining({ rule: "PERM-4" }),
  ]);
  // A read the block asks for stands: the fork rules don't decide it.
  expect(fork["token.contents"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-3",
    "PERM-4",
  ]);
  expect(fork.secrets!.causes).toEqual([
    {
      rule: "FK-2",
      spans: [],
      inputs: [{ path: "event.actor", value: "fork" }],
    },
  ]);
  // PERM-3, #15 §4: the block leaves id-token out, so it stays none.
  expect(fork["token.id-token"]).toMatchObject({
    value: "none",
    causes: [{ rule: "PERM-3", spans: [{ line: 42 }] }, { rule: "PERM-4" }],
  });

  const member = accessOf(
    simulate(example, actorPr("member")).verdicts,
    "ci.yml › test",
  );
  expect(member["token.pull-requests"]!.value).toBe("write");
  expect(member.secrets).toMatchObject({
    value: "available",
    causes: [{ rule: "FK-0" }],
  });
});

test("a fork's pull_request still resolves write-all to read (PERM-2), and the permissive baseline's writes to read", () => {
  const files = [
    wf("a.yml", `on: pull_request\npermissions: write-all\n${jobs}`),
    wf("b.yml", `on: pull_request\n${jobs}`),
  ];
  const { verdicts } = simulate(files, {
    event: { name: "pull_request", actor: "fork" },
    repo: { date, tokenDefault: "permissive" },
  });
  const a = accessOf(verdicts, "a.yml › a");
  expect(levels(a)).toEqual(
    allScopes("read", {
      // write-all gives them write, a level a fork's run can't be shown to hold (PERM-8).
      "token.id-token": ["none", "write"],
      "token.copilot-requests": ["none", "write"],
      secrets: "empty",
    }),
  );
  expect(a["token.actions"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-2",
    "PERM-6",
    "PERM-3",
  ]);
  const b = accessOf(verdicts, "b.yml › a");
  expect(b["token.issues"]).toMatchObject({ value: "read" });
  expect(b["token.issues"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-2",
    "PERM-1",
  ]);
  // The permissive baseline's own PERM-8 stands.
  expect(b["token.id-token"]).toMatchObject({
    value: "uncertain",
    causes: [{ rule: "PERM-8" }, { rule: "PERM-1" }],
  });
});

test.each(["fork", "dependabot"] as const)(
  "on a %s run whose job sets id-token: write, token.id-token is Uncertain [none, write] (PERM-8) with an empty settle",
  (actor) => {
    const { verdicts } = simulate(
      [
        wf(
          "ci.yml",
          `on: pull_request\njobs:\n  a:\n    permissions:\n      id-token: write\n${steps}`,
        ),
      ],
      { event: { name: "pull_request", actor }, repo: { date } },
    );
    expect(accessOf(verdicts, "ci.yml › a")["token.id-token"]).toEqual({
      key: "ci.yml › a › token.id-token",
      value: "uncertain",
      causes: [
        {
          rule: "PERM-8",
          spans: [],
          inputs: [{ path: "event.actor", value: actor }],
        },
        expect.objectContaining({
          rule: "PERM-3",
          spans: [expect.objectContaining({ line: 5 })],
        }),
        ...(actor === "dependabot"
          ? [expect.objectContaining({ rule: "FK-8" })]
          : []),
      ],
      possible: ["none", "write"],
      settle: [],
    });
  },
);

test("a dependabot[bot] pull_request gets dependabot-only secrets (FK-8) and a read-only token (root FK-8) that permissions: can raise (FK-8 cited)", () => {
  const files = [
    wf("a.yml", `on: pull_request\n${jobs}`),
    wf(
      "b.yml",
      `on: pull_request\njobs:\n  a:\n    permissions:\n      pull-requests: write\n${steps}`,
    ),
  ];
  const { verdicts } = simulate(files, {
    event: { name: "pull_request", actor: "dependabot" },
    repo: { date, tokenDefault: "permissive" },
  });
  const a = accessOf(verdicts, "a.yml › a");
  expect(a.secrets).toMatchObject({
    value: "dependabot-only",
    causes: [
      { rule: "FK-8", inputs: [{ path: "event.actor", value: "dependabot" }] },
    ],
  });
  expect(a["token.contents"]).toMatchObject({ value: "read" });
  expect(a["token.contents"]!.causes.map((c) => c.rule)).toEqual([
    "FK-8",
    "PERM-1",
  ]);
  const b = accessOf(verdicts, "b.yml › a");
  expect(b["token.pull-requests"]).toMatchObject({ value: "write" });
  expect(b["token.pull-requests"]!.causes.map((c) => c.rule)).toEqual([
    "PERM-3",
    "FK-8",
  ]);
  // No actor rule is a Platform baseline item: PRT-6 is never shown.
  expect(
    verdicts.flatMap((v) => v.causes).some((c) => c.rule === "PRT-6"),
  ).toBe(false);
});

test("a dependabot[bot] push is simulated, with dependabot-only secrets", () => {
  const { verdicts } = simulate([wf("ci.yml", `on: push\n${jobs}`)], {
    event: { name: "push", actor: "dependabot" },
    repo: { date },
  });
  expect(byKey(verdicts, "ci.yml")).toMatchObject({ value: "runs" });
  expect(byKey(verdicts, "ci.yml › a › secrets")).toMatchObject({
    value: "dependabot-only",
  });
});

test("a fork contributor's pull_request awaiting approval makes the GitHub workflow pending (root FK-4, then PL-5) and its jobs no-run; a skipped one stays skipped", () => {
  const { verdicts } = simulate(
    example,
    actorPr("fork", { approval: "awaiting" }),
  );
  const ci = byKey(verdicts, "ci.yml")!;
  expect(ci.value).toBe("pending");
  expect(ci.causes.slice(0, 3)).toEqual([
    {
      rule: "FK-4",
      spans: [],
      inputs: [{ path: "event.approval", value: "awaiting" }],
    },
    { rule: "PL-5", spans: [], inputs: [] },
    expect.objectContaining({ rule: "PA-2" }),
  ]);
  // Each job copies the GitHub workflow's chain.
  for (const id of ["build", "changes", "e2e", "test"])
    expect(byKey(verdicts, `ci.yml › ${id}`)).toMatchObject({
      value: "no-run",
      causes: ci.causes,
    });
  expect(byKey(verdicts, "triage.yml")).toMatchObject({ value: "skipped" });
  // Access is computed as if the job runs (ADR 0001).
  expect(byKey(verdicts, "ci.yml › test › token.pull-requests")!.value).toBe(
    "read",
  );
});

test("Approval defaults to approved (WN-5): it follows the root on the fork's GitHub workflow and jobs it decides, and never on a member's", () => {
  const fork = simulate(example, actorPr("fork")).verdicts;
  expect(byKey(fork, "ci.yml")!.value).toBe("runs");
  for (const key of ["ci.yml", "ci.yml › build"])
    expect(byKey(fork, key)!.causes).toContainEqual(
      wn5("event.approval", "approved"),
    );
  // Skipped either way, so Approval doesn't decide it.
  expect(byKey(fork, "triage.yml")!.causes).not.toContainEqual(
    wn5("event.approval", "approved"),
  );
  const member = simulate(example, actorPr("member")).verdicts;
  expect(
    member.some((v) =>
      v.causes.some((c) => c.inputs.some((i) => i.path === "event.approval")),
    ),
  ).toBe(false);
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

test("github.event.action comes from the Event: empty on a push, the activity type on a pull_request, and one of GitHub's default types, settled by the Event's activity type, when it has none", () => {
  const opened = "github.event.action == 'opened'";
  const onPush = wf(
    "ci.yml",
    `on: push\njobs:\n${job("a", `    if: ${opened}\n`)}`,
  );
  expect(byKey(simulate([onPush], push).verdicts, "ci.yml › a")).toMatchObject({
    value: "skipped",
  });

  const files = [
    reading({ opened, closed: "github.event.action == 'closed'" }),
  ];
  const typed = { ...pr, event: { name: "pull_request", type: "opened" } };
  expect(
    byKey(simulate(files, typed).verdicts, "pr.yml › opened"),
  ).toMatchObject({ value: "runs" });

  const untyped = simulate(files, pr).verdicts;
  // None of opened, synchronize and reopened is closed.
  expect(byKey(untyped, "pr.yml › closed")).toMatchObject({ value: "skipped" });
  const a = byKey(untyped, "pr.yml › opened")!;
  expect(a).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: ["event.type"],
    hints: [
      {
        path: "event.type",
        candidates: ["opened", "synchronize", "reopened"],
      },
    ],
  });
  expect(a.causes[0]!.rule).toBe("WN-4");
  const settled = settleValue(pr, "event.type", "opened");
  expect(settled.event.type).toBe("opened");
  expect(
    byKey(simulate(files, settled).verdicts, "pr.yml › opened"),
  ).toMatchObject({ value: "runs" });
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
  // The settle path-setter refuses __proto__, so the core never offers it: only a JSON
  // Scenario can hold those keys.
  expect(
    ["ctor", "proto", "payload"].map((id) => byKey(unset, `pr.yml › ${id}`)),
  ).toMatchObject([
    { value: "uncertain", settle: ["vars.CONSTRUCTOR"] },
    { value: "uncertain", settle: [] },
    { value: "uncertain", settle: [] },
  ]);
  for (const v of unset)
    for (const path of v.settle ?? [])
      expect(() => settleValue(pr, path, "x")).not.toThrow();

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

// pull_request_target (#65): GitHub's 2 December block, its write token and checkout's refusal.
const forkTarget = (extra = {}, repo = {}) => ({
  event: {
    name: "pull_request_target",
    actor: "fork" as const,
    ref: "feature",
    base: "main",
    changed: ["src/app.ts"],
    ...extra,
  },
  repo: { date, ...repo },
});

test("the example's Fork target on 2026-12-03: triage.yml fails (root PRT-2, then PRT-3), with WN-5 causes for visibility, predates and event policy, and its job no-run", () => {
  const { verdicts } = simulate(example, forkTarget());
  const triage = byKey(verdicts, "triage.yml")!;
  expect(triage.value).toBe("fails");
  expect(triage.causes.map((c) => c.rule).slice(0, 2)).toEqual([
    "PRT-2",
    "PRT-3",
  ]);
  expect(triage.causes[1]!.inputs).toEqual([
    { path: "repo.date", value: "2026-12-03" },
  ]);
  for (const [path, value] of [
    ["repo.visibility", "public"],
    ["repo.predates", true],
    ["repo.eventPolicy", "none"],
  ] as const)
    expect(triage.causes).toContainEqual(wn5(path, value));
  // WN-5 follows the root, never replaces it.
  expect(triage.causes.findIndex((c) => c.rule === "WN-5")).toBeGreaterThan(1);
  expect(byKey(verdicts, "triage.yml › triage")).toMatchObject({
    value: "no-run",
    causes: triage.causes,
  });
  // The other GitHub workflows don't list pull_request_target.
  expect(byKey(verdicts, "ci.yml")!.value).toBe("skipped");
});

test("the example's Fork target on 2026-12-01: triage.yml runs (FK-6, then PRT-3 in evaluate mode, DB-4), with pull-requests write and secrets available (FK-7), and triage fails at its checkout (root CO-1)", () => {
  const { verdicts } = simulate(
    example,
    forkTarget({}, { date: "2026-12-01" }),
  );
  const triage = byKey(verdicts, "triage.yml")!;
  expect(triage.value).toBe("runs");
  expect(triage.causes.map((c) => c.rule)).toEqual(
    expect.arrayContaining(["EV-0", "EV-1", "DB-4", "FK-6", "PRT-3"]),
  );
  expect(byKey(verdicts, "triage.yml › triage › token.pull-requests")).toEqual({
    key: "triage.yml › triage › token.pull-requests",
    value: "write",
    causes: [
      expect.objectContaining({ rule: "PERM-3" }),
      expect.objectContaining({ rule: "FK-7" }),
    ],
  });
  expect(byKey(verdicts, "triage.yml › triage › secrets")).toMatchObject({
    value: "available",
    causes: [{ rule: "FK-7" }],
  });
  const job = byKey(verdicts, "triage.yml › triage")!;
  expect(job.value).toBe("fails");
  // The root rests on the checkout step and its ref: line.
  expect(job.causes[0]).toMatchObject({
    rule: "CO-1",
    spans: [
      expect.objectContaining({ line: 12 }),
      expect.objectContaining({ line: 14 }),
    ],
    inputs: [{ path: "event.actor", value: "fork" }],
  });
  expect(RULES["CO-1"]!.text).toContain(
    "Refusing to check out fork pull request code from a 'pull_request_target' workflow.",
  );
  // Never the opt-out (#5).
  expect(RULES["CO-1"]!.text).not.toContain("allow-unsafe-pr-checkout");
});

// A pull_request_target GitHub workflow whose job checks out with `step` (YAML under `steps:`).
const target = (step: string, on = "pull_request_target") => [
  wf(
    "t.yml",
    `on: ${on}\njobs:\n  t:\n    runs-on: x\n    steps:\n${step}      - run: echo\n`,
  ),
];
const checkout = (version: string, inputs: string, extra = "") =>
  `      - uses: actions/checkout@${version}\n${extra}        with:\n${inputs}`;
const headSha = "          ref: ${{ github.event.pull_request.head.sha }}\n";
const on1201 = { date: "2026-12-01" };

test("step-level continue-on-error: true on the refused checkout keeps the job running (WN-2), with the refusal still a cause (CO-6, then CO-1)", () => {
  const { verdicts } = simulate(
    target(checkout("v4", headSha, "        continue-on-error: true\n")),
    forkTarget({}, on1201),
  );
  const job = byKey(verdicts, "t.yml › t")!;
  expect(job.value).toBe("runs");
  expect(job.causes.map((c) => c.rule)).toEqual(["CO-6", "CO-1", "WN-2"]);
  expect(job.causes[0]!.spans[0]).toMatchObject({ line: 7 });
});

test.each<[string, Partial<Scenario["repo"]>, string, string[]]>([
  ["a private repo runs", { visibility: "private" }, "runs", ["PRT-2"]],
  ["an internal repo runs", { visibility: "internal" }, "runs", ["PRT-2"]],
  [
    "a date before 2026-12-02 runs, in evaluate mode",
    { date: "2026-12-01" },
    "runs",
    ["PRT-3"],
  ],
  [
    "an event policy that allows it runs",
    { eventPolicy: "allows" },
    "runs",
    ["PRT-1"],
  ],
  [
    "an event policy that blocks it fails",
    { eventPolicy: "blocks", predates: false },
    "fails",
    ["PRT-1", "PRT-5", "PL-10"],
  ],
  [
    "a public repo that predates 2026-09-17 with no event policy fails",
    { visibility: "public", predates: true, eventPolicy: "none" },
    "fails",
    ["PRT-2", "PRT-3", "PRT-5", "PL-10"],
  ],
])(
  "PRT table, on a same-repo pull_request_target on 2026-12-03 unless set: %s",
  (_, repo, value, rules) => {
    const { verdicts } = simulate(
      target("      - uses: actions/checkout@v4\n"),
      {
        event: { name: "pull_request_target", base: "main" },
        repo: { date, ...repo },
      },
    );
    const t = byKey(verdicts, "t.yml")!;
    expect(t.value).toBe(value);
    const cited = t.causes.map((c) => c.rule);
    if (value === "fails") expect(cited.slice(0, rules.length)).toEqual(rules);
    else expect(cited).toEqual(expect.arrayContaining(["EV-0", ...rules]));
    // A run's jobs run; a failed run's are no-run.
    expect(byKey(verdicts, "t.yml › t")!.value).toBe(
      value === "fails" ? "no-run" : "runs",
    );
  },
);

test("PRT table: a public repo created after 2026-09-17 with no event policy is Uncertain [fails, runs] on 2026-12-03 (root PRT-4), settled by the event policy", () => {
  const files = target("      - uses: actions/checkout@v4\n");
  const scenario = forkTarget({}, { predates: false });
  const t = byKey(simulate(files, scenario).verdicts, "t.yml")!;
  expect(t).toMatchObject({
    value: "uncertain",
    possible: ["fails", "runs"],
    settle: ["repo.eventPolicy"],
    hints: [
      {
        path: "repo.eventPolicy",
        candidates: ["allows", "blocks"],
      },
    ],
  });
  expect(t.causes[0]!.rule).toBe("PRT-4");
  expect(t.causes).toContainEqual(wn5("repo.eventPolicy", "none"));
  const settled = settleValue(scenario, "repo.eventPolicy", "blocks");
  expect(byKey(simulate(files, settled).verdicts, "t.yml")!.value).toBe(
    "fails",
  );
});

test("the jobs of an Uncertain GitHub workflow keep its root and say what they'd be either way: no-run, or their own Verdict when it runs, with its settle hints", () => {
  const files = target("      - uses: actions/checkout@v4\n");
  const t = byKey(
    simulate(files, forkTarget({}, { predates: false })).verdicts,
    "t.yml › t",
  )!;
  expect(t).toMatchObject({
    value: "uncertain",
    possible: ["no-run", "runs"],
    settle: ["repo.eventPolicy"],
    hints: [{ path: "repo.eventPolicy", candidates: ["allows", "blocks"] }],
  });
  expect(t.causes[0]!.rule).toBe("PRT-4");

  // A job whose if: is false is skipped whenever the run goes ahead.
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on:\n  push:\n    branches:\n      - refs/heads/main\njobs:\n" +
          job("b", "    if: false\n"),
      ),
    ],
    { ...push, event: { name: "push", ref: "refs/heads/main" } },
  );
  expect(byKey(verdicts, "ci.yml › b")).toMatchObject({
    possible: ["no-run", "skipped"],
  });
});

test("a dependabot[bot] pull_request_target in a public repo follows the PRT table like any actor, and gets the write token and secrets (FK-7)", () => {
  const files = target(checkout("v4", headSha));
  const bot = (repo = {}) =>
    simulate(files, {
      event: { name: "pull_request_target", actor: "dependabot" },
      repo: { date, ...repo },
    }).verdicts;
  const t = byKey(bot(), "t.yml")!;
  expect(t.value).toBe("fails");
  expect(t.causes.map((c) => c.rule).slice(0, 2)).toEqual(["PRT-2", "PRT-3"]);
  const before = bot(on1201);
  expect(byKey(before, "t.yml › t")!.value).toBe("runs");
  expect(byKey(before, "t.yml › t › secrets")).toMatchObject({
    value: "available",
    causes: [{ rule: "FK-7" }],
  });
});

test("a fork contributor's pull_request_target awaiting approval still runs (FK-6): Approval is ignored and decides nothing", () => {
  const { verdicts } = simulate(
    target("      - uses: actions/checkout@v4\n"),
    forkTarget({ approval: "awaiting" }, on1201),
  );
  const t = byKey(verdicts, "t.yml")!;
  expect(t.value).toBe("runs");
  expect(t.causes.map((c) => c.rule)).toContain("FK-6");
  expect(t.causes).not.toContainEqual(
    expect.objectContaining({ rule: "FK-4" }),
  );
  expect(byKey(verdicts, "t.yml › t")!.value).toBe("runs");
});

test.each([
  ["a SHA pin", "8e8c483db84b4bee98b60c0593521ed34d9990e8"],
  ["a minor pin", "v4.2"],
  ["a patch pin", "v4.2.2"],
])(
  "%s of checkout before v7 is Uncertain [fails, runs] (root CO-3, then CO-1), with nothing to settle it",
  (_, version) => {
    const job = byKey(
      simulate(target(checkout(version, headSha)), forkTarget({}, on1201))
        .verdicts,
      "t.yml › t",
    )!;
    expect(job).toMatchObject({
      value: "uncertain",
      possible: ["fails", "runs"],
      settle: [],
    });
    expect(job.causes.map((c) => c.rule)).toEqual(["CO-3", "CO-1"]);
  },
);

test("checkout's refusal applies to v7 releases and floating majors from v2, never to v1, a same-repo PR, a default checkout or the opt-out", () => {
  const job = (step: string, event = {}) =>
    byKey(
      simulate(target(step), forkTarget(event, on1201)).verdicts,
      "t.yml › t",
    )!.value;
  expect(job(checkout("v7.0.1", headSha))).toBe("fails");
  expect(job(checkout("v2", headSha))).toBe("fails");
  expect(job(checkout("v1", headSha))).toBe("runs");
  expect(job(checkout("v4", headSha), { actor: "member" })).toBe("runs");
  expect(job("      - uses: actions/checkout@v4\n")).toBe("runs");
  expect(
    job(checkout("v4", `${headSha}          allow-unsafe-pr-checkout: true\n`)),
  ).toBe("runs");
});

test("checkout refuses repository: the head repo, a refs/pull ref and the merge commit; the head branch name and the default branch's ref aren't the fork's commit", () => {
  const job = (inputs: string) =>
    byKey(
      simulate(target(checkout("v4", inputs)), forkTarget({}, on1201)).verdicts,
      "t.yml › t",
    )!;
  const repo = job(
    "          repository: ${{ github.event.pull_request.head.repo.full_name }}\n",
  );
  expect(repo.value).toBe("fails");
  expect(repo.causes[0]!.spans[1]).toMatchObject({ line: 8 });
  expect(job("          ref: refs/pull/7/merge\n").value).toBe("fails");
  expect(
    job("          ref: ${{ github.event.pull_request.merge_commit_sha }}\n")
      .value,
  ).toBe("fails");
  expect(
    job("          ref: ${{ github.event.pull_request.head.ref }}\n").value,
  ).toBe("runs");
  expect(job("          ref: ${{ github.sha }}\n").value).toBe("runs");
  expect(job("          ref: main\n").value).toBe("runs");
});

test("a checkout ref known only at run time is Uncertain [fails, runs] (CO-5), root WN-4 at the ref, with that path in settle when a Scenario input holds it", () => {
  const job = (inputs: string) =>
    byKey(
      simulate(target(checkout("v4", inputs)), forkTarget({}, on1201)).verdicts,
      "t.yml › t",
    )!;
  const label = job(
    "          ref: ${{ github.event.pull_request.head.label }}\n",
  );
  expect(label).toMatchObject({
    value: "uncertain",
    possible: ["fails", "runs"],
    settle: ["github.event.pull_request.head.label"],
    hints: [{ path: "github.event.pull_request.head.label" }],
  });
  expect(label.causes.map((c) => c.rule)).toEqual(["WN-4", "CO-5", "CO-1"]);
  expect(label.causes[0]!.spans[0]).toMatchObject({ line: 8 });

  const step = job("          ref: ${{ steps.pr.outputs.sha }}\n");
  expect(step).toMatchObject({ value: "uncertain", settle: [] });

  // A function result such as hashFiles() exists only at run time too.
  const hashed = job("          ref: ${{ hashFiles('x') }}\n");
  expect(hashed).toMatchObject({
    value: "uncertain",
    possible: ["fails", "runs"],
    settle: [],
  });
  expect(hashed.causes.map((c) => c.rule)).toEqual(["WN-4", "CO-5", "CO-1"]);
});

test("pull_request_target takes the default activity types (EV-1) and branch filters on the base branch (BR-2), isn't skipped by [skip ci] (SK-1), and reads github.ref as the default branch (DB-4)", () => {
  const files = [
    wf(
      "t.yml",
      "on:\n  pull_request_target:\n    branches: [main]\njobs:\n  t:\n    if: github.ref == 'refs/heads/main'\n    runs-on: x\n    steps:\n      - run: echo\n",
    ),
  ];
  const run = (event = {}) =>
    simulate(files, forkTarget(event, on1201)).verdicts;
  const t = byKey(run({ message: "fix [skip ci]" }), "t.yml")!;
  expect(t.value).toBe("runs");
  expect(t.causes.map((c) => c.rule)).toEqual(
    expect.arrayContaining(["BR-4", "BR-2", "EV-1", "DB-4"]),
  );
  expect(byKey(run(), "t.yml › t")!.value).toBe("runs");
  expect(byKey(run({ base: "dev" }), "t.yml")!.value).toBe("skipped");
  expect(byKey(run({ type: "labeled" }), "t.yml")).toMatchObject({
    value: "skipped",
    causes: [{ rule: "EV-1" }],
  });
});

test("a base branch that looks like a SHA is Uncertain [runs, skipped] (BR-9) only when the GitHub workflow would run", () => {
  const files = [
    wf(
      "t.yml",
      "on:\n  pull_request_target:\n    branches-ignore: [deadbeef]\njobs:\n  t:\n    runs-on: x\n    steps:\n      - run: echo\n",
    ),
  ];
  const run = (base: string) =>
    byKey(simulate(files, forkTarget({ base }, on1201)).verdicts, "t.yml")!;
  expect(run("cafe1234")).toMatchObject({
    value: "uncertain",
    possible: ["runs", "skipped"],
    settle: [],
  });
  expect(run("cafe1234").causes[0]).toEqual({
    rule: "BR-9",
    spans: [],
    inputs: [{ path: "event.base", value: "cafe1234" }],
  });
  // Skipped by the filter either way.
  expect(run("deadbeef").value).toBe("skipped");
  expect(run("main").value).toBe("runs");
});

// Required checks (#71)

const required = { repo: { date, required: ["build", "test"] } };

test("the example on a member's docs-only PR: check › build and check › test are Pending and blocks merge, root RQ-1 then PA-2 at the paths: line, quoting RQ-8", () => {
  const { verdicts } = simulate(example, {
    event: { ...actorPr("member").event, changed: ["docs/README.md"] },
    ...required,
  });
  for (const key of ["check › build", "check › test"]) {
    const check = byKey(verdicts, key)!;
    expect(check.value).toBe("pending and blocks merge");
    const rules = check.causes.map((c) => c.rule);
    expect(rules.slice(0, 2)).toEqual(["RQ-1", "PA-2"]);
    expect(rules).toContain("RQ-8");
    expect(check.causes[1]).toMatchObject({
      spans: [{ path: ".github/workflows/ci.yml", line: 5 }],
      inputs: [{ path: "event.changed", value: ["docs/README.md"] }],
    });
  }
});

test("the example's Fork PR: check › build and check › test pass, root RQ-4, their jobs running (WN-2) on the assumed Approval (WN-5)", () => {
  const { verdicts } = simulate(example, { ...actorPr("fork"), ...required });
  for (const key of ["check › build", "check › test"]) {
    const check = byKey(verdicts, key)!;
    expect(check.value).toBe("passes");
    expect(check.causes.map((c) => c.rule)).toEqual(["RQ-4", "WN-2", "WN-5"]);
  }
});

// Each Passes and Pending and blocks merge row of #6's badge table, on the `chain` set:
// lint is skipped by its own if:, docs through a needs chain rooted in it, test runs.
const checksOf = (
  files: { path: string; text: string }[],
  scenario: Scenario,
) =>
  Object.fromEntries(
    simulate(files, scenario)
      .verdicts.filter((v) => v.key.startsWith("check › "))
      .map((v) => [v.key.slice(8), [v.value, ...v.causes.map((c) => c.rule)]]),
  );

test("a required job that runs passes (RQ-4); one skipped by its own if: passes (RQ-2), as does one skipped through a needs chain rooted in an if: skip", () => {
  expect(
    checksOf([chain], {
      ...push,
      repo: { date, required: ["test", "lint", "docs"] },
    }),
  ).toEqual({
    test: ["passes", "RQ-4", "WN-2"],
    lint: ["passes", "RQ-2", "JG-3"],
    docs: ["passes", "RQ-2", "JG-3", "JG-1"],
  });
});

test("a required name no job produces is Pending and blocks merge, root RQ-0 with the typed name", () => {
  const { verdicts } = simulate([chain], {
    ...push,
    repo: { date, required: ["unit"] },
  });
  expect(byKey(verdicts, "check › unit")).toEqual({
    key: "check › unit",
    value: "pending and blocks merge",
    causes: [
      {
        rule: "RQ-0",
        spans: [],
        inputs: [{ path: "repo.required", value: "unit" }],
      },
      { rule: "RQ-8", spans: [], inputs: [] },
    ],
  });
});

test("a check is named after the job's name: when set and non-empty, else its id, never the workflow (RQ-0)", () => {
  const named = wf(
    "ci.yml",
    "name: CI\non: push\njobs:\n" +
      job("b", "    name: Build\n") +
      job("t", "    name: ''\n"),
  );
  expect(
    checksOf([named], {
      ...push,
      repo: { date, required: ["Build", "b", "t", "CI / t"] },
    }),
  ).toEqual({
    Build: ["passes", "RQ-4", "WN-2"],
    b: ["pending and blocks merge", "RQ-0", "RQ-8"],
    t: ["passes", "RQ-4", "WN-2"],
    "CI / t": ["pending and blocks merge", "RQ-0", "RQ-8"],
  });
});

test("a branch-filtered or commit-message-skipped GitHub workflow leaves its required checks Pending and blocks merge (RQ-1)", () => {
  const files = [
    wf("ci.yml", `on:\n  push:\n    branches: [main]\njobs:\n${job("build")}`),
  ];
  const scenario = (event: Event) => ({
    event,
    repo: { date, required: ["build"] },
  });
  expect(
    checksOf(files, scenario({ name: "push", ref: "feature" })).build!.slice(
      0,
      3,
    ),
  ).toEqual(["pending and blocks merge", "RQ-1", "BR-4"]);
  expect(
    checksOf(
      files,
      scenario({ name: "push", ref: "main", message: "fix [skip ci]" }),
    ).build!.slice(0, 3),
  ).toEqual(["pending and blocks merge", "RQ-1", "SK-1"]);
});

test("strict mode adds RQ-10 as an Explanation note on every check, never changing the badge", () => {
  const checks = checksOf([chain], {
    ...push,
    repo: { date, required: ["test", "gone"], strict: true },
  });
  expect(checks).toEqual({
    test: ["passes", "RQ-4", "WN-2", "RQ-10"],
    gone: ["pending and blocks merge", "RQ-0", "RQ-8", "RQ-10"],
  });
});

test("checks exist only for activity types that create a SHA: a labeled pull_request's checks are unsupported (WN-3)", () => {
  const { verdicts } = simulate(example, {
    ...actorPr("member", { type: "labeled" }),
    ...required,
  });
  expect(byKey(verdicts, "check › build")).toEqual({
    key: "check › build",
    value: "unsupported",
    causes: [
      {
        rule: "WN-3",
        spans: [],
        inputs: [{ path: "event.type", value: "labeled" }],
      },
    ],
  });
});

test("a required name typed twice gets one key, and with no required checks there are none", () => {
  const keys = (names: string[]) =>
    simulate([chain], { ...push, repo: { date, required: names } })
      .verdicts.map((v) => v.key)
      .filter((k) => k.startsWith("check › "));
  expect(keys(["test", "test"])).toEqual(["check › test"]);
  expect(keys([])).toEqual([]);
});

test("a check › <name> key is never a candidate for an Assumption on a job", () => {
  const { unmatchedAssumptions } = simulate([chain], {
    ...push,
    repo: { date, required: ["test"] },
    assume: { "old.yml › test": "fails" },
  });
  expect(unmatchedAssumptions).toEqual([
    { key: "old.yml › test", candidates: ["ci.yml › test"] },
  ]);
});

// Failures, approval and every producer (#72)

test("with the Assumption \"job X fails\", X's check fails and blocks merge (RQ-4, then WN-1), and a required check skipped through X's needs may not block (RQ-3)", () => {
  const checks = checksOf([chain], {
    ...push,
    repo: { date, required: ["test", "deploy", "report"] },
    assume: { "ci.yml › test": "fails" },
  });
  expect(checks.test).toEqual(["fails and blocks merge", "RQ-4", "WN-1"]);
  expect(checks.deploy!.slice(0, 4)).toEqual([
    "may not block",
    "RQ-3",
    "WN-1",
    "JG-1",
  ]);
  // always() runs it past the failure, so it reports.
  expect(checks.report![0]).toBe("passes");
});

test("the example's e2e, skipped because changes fails, may not block (RQ-3, then WN-1): its if: reads changes' output only as if changes had succeeded", () => {
  const { verdicts } = simulate(example, {
    ...actorPr("fork"),
    repo: { date, required: ["e2e"] },
    assume: { "ci.yml › changes": "fails" },
  });
  expect(
    chainOf(verdicts, "ci.yml › e2e")
      .map(([rule]) => rule)
      .slice(0, 3),
  ).toEqual(["WN-1", "JG-1", "JG-2"]);
  expect(
    byKey(verdicts, "check › e2e")!
      .causes.map((c) => c.rule)
      .slice(0, 3),
  ).toEqual(["RQ-3", "WN-1", "JG-1"]);
  expect(byKey(verdicts, "check › e2e")!.value).toBe("may not block");
});

test("a job that fails at a refused checkout fails and blocks merge (RQ-4, then CO-1)", () => {
  const checks = checksOf(example, {
    ...forkTarget({}, { date: "2026-12-01" }),
    repo: { date: "2026-12-01", required: ["triage"] },
  });
  expect(checks.triage!.slice(0, 3)).toEqual([
    "fails and blocks merge",
    "RQ-4",
    "CO-1",
  ]);
});

test("a GitHub workflow a policy fails fails and blocks merge, PRT-5's unknown check conclusion only noted", () => {
  const { verdicts } = simulate(example, {
    ...forkTarget(),
    repo: { date, required: ["triage"] },
  });
  const check = byKey(verdicts, "check › triage")!;
  expect(check.value).toBe("fails and blocks merge");
  expect(check.causes.map((c) => c.rule).slice(0, 3)).toEqual([
    "RQ-4",
    "PRT-2",
    "PRT-3",
  ]);
  expect(check.causes.map((c) => c.rule)).toContain("PRT-5");
});

test("a required job that fails with continue-on-error: true is Uncertain (JG-11) [fails and blocks merge, passes], its settle empty", () => {
  const { verdicts } = simulate(
    [
      wf(
        "ci.yml",
        "on: push\njobs:\n" + job("flaky", "    continue-on-error: true\n"),
      ),
    ],
    {
      ...push,
      repo: { date, required: ["flaky"] },
      assume: { "ci.yml › flaky": "fails" },
    },
  );
  const check = byKey(verdicts, "check › flaky")!;
  expect(check).toMatchObject({
    value: "uncertain",
    possible: ["fails and blocks merge", "passes"],
    settle: [],
  });
  expect(check.causes.map((c) => [c.rule, c.spans[0]?.line])).toEqual([
    ["JG-11", 4],
    ["RQ-4", undefined],
    ["WN-1", 3],
  ]);
});

test("a check whose producer is Uncertain is Uncertain with its chain: the example's e2e reads an output the Scenario lacks (WN-4)", () => {
  const { verdicts } = simulate(example, {
    ...actorPr("fork"),
    repo: { date, required: ["e2e"] },
  });
  const check = byKey(verdicts, "check › e2e")!;
  expect(check.value).toBe("uncertain");
  expect(check.causes[0]!.rule).toBe("WN-4");
  expect(check.settle).toEqual(["ci.yml › changes › outputs.src"]);
});

test("two jobs with one check name are Uncertain, root RQ-0 at both jobs", () => {
  const { verdicts } = simulate(
    [
      wf("a.yml", `on: push\njobs:\n${job("build")}`),
      wf("b.yml", `on: push\njobs:\n${job("other", "    name: build\n")}`),
    ],
    { ...push, repo: { date, required: ["build"] } },
  );
  const check = byKey(verdicts, "check › build")!;
  expect(check).toMatchObject({
    value: "uncertain",
    possible: ["passes"],
    settle: [],
  });
  expect(check.causes).toEqual([
    {
      rule: "RQ-0",
      spans: [
        expect.objectContaining({ path: ".github/workflows/a.yml", line: 3 }),
        expect.objectContaining({ path: ".github/workflows/b.yml", line: 3 }),
      ],
      inputs: [{ path: "repo.required", value: "build" }],
    },
  ]);
});

test("a check whose only producer's file has a Diagnostic is Uncertain, root RQ-0 at the job and the Diagnostic", () => {
  const { verdicts, diagnostics } = simulate(
    [wf("ci.yml", `on: push\njobs:\n${job("build", "    bogus: 1\n")}`)],
    { ...push, repo: { date, required: ["build"] } },
  );
  expect(diagnostics).not.toEqual([]);
  expect(byKey(verdicts, "check › build")).toEqual({
    key: "check › build",
    value: "uncertain",
    causes: [
      {
        rule: "RQ-0",
        spans: [
          expect.objectContaining({ line: 3 }),
          expect.objectContaining({ line: diagnostics[0]!.line }),
        ],
        inputs: [],
      },
    ],
    settle: [],
  });
});

test("a fork contributor's run awaiting approval leaves every check it would produce Pending and blocks merge (root FK-4, then PL-5), quoting RQ-8", () => {
  const { verdicts } = simulate(example, {
    ...actorPr("fork", { approval: "awaiting" }),
    repo: { date, required: ["build", "test"] },
  });
  for (const key of ["check › build", "check › test"]) {
    const check = byKey(verdicts, key)!;
    expect(check.value).toBe("pending and blocks merge");
    const rules = check.causes.map((c) => c.rule);
    expect(rules.slice(0, 2)).toEqual(["FK-4", "PL-5"]);
    expect(rules).toContain("RQ-8");
  }
});

// Runs only on a push: a PR's own run is skipped (EV-0), so only the implied push reports.
const pushOnly = [
  wf("ci.yml", `on:\n  push:\n    branches: [feature]\njobs:\n${job("build")}`),
];

test("a same-repo PR counts a check from a push-triggered job on the head SHA, noting PA-4; so does a Dependabot PR, but a fork's never pushes to the repo", () => {
  for (const actor of ["member", "dependabot"] as const) {
    const { verdicts } = simulate(pushOnly, {
      ...actorPr(actor),
      repo: { date, required: ["build"] },
    });
    // The PR's own GitHub workflow Verdict stays skipped.
    expect(byKey(verdicts, "ci.yml")!.value).toBe("skipped");
    const check = byKey(verdicts, "check › build")!;
    expect(check.value).toBe("passes");
    expect(check.causes.slice(0, 2)).toEqual([
      { rule: "RQ-4", spans: [], inputs: [] },
      {
        rule: "PA-4",
        spans: [],
        inputs: [{ path: "event.changed", value: ["src/app.ts"] }],
      },
    ]);
  }
  const fork = simulate(pushOnly, {
    ...actorPr("fork"),
    repo: { date, required: ["build"] },
  });
  expect(
    byKey(fork.verdicts, "check › build")!.causes.map((c) => c.rule),
  ).toEqual(["RQ-1", "EV-0", "RQ-8"]);
});

test("a same-repo PR whose push and PR runs are both filtered out stays Pending, with the PR's own chain (RQ-1, then PA-2)", () => {
  const { verdicts } = simulate(example, {
    ...actorPr("member", { changed: ["docs/README.md"] }),
    repo: { date, required: ["build"] },
  });
  expect(
    byKey(verdicts, "check › build")!
      .causes.map((c) => c.rule)
      .slice(0, 2),
  ).toEqual(["RQ-1", "PA-2"]);
});

test("a required name that differs only in case from the job's name is Uncertain, root RQ-0 at the job [passes, pending and blocks merge]", () => {
  const { verdicts } = simulate([chain], {
    ...push,
    repo: { date, required: ["Test"] },
  });
  const check = byKey(verdicts, "check › Test")!;
  expect(check).toMatchObject({
    value: "uncertain",
    possible: ["passes", "pending and blocks merge"],
    settle: [],
  });
  expect(check.causes.map((c) => [c.rule, c.spans[0]?.line])).toEqual([
    ["RQ-0", 8],
    ["RQ-4", undefined],
    ["WN-2", 8],
  ]);
});

test("a name: expression is evaluated for the check name, and one needing a value the Scenario lacks is Uncertain (WN-4 at the name:) until it's given", () => {
  const files = [
    wf(
      "ci.yml",
      "on: push\njobs:\n" +
        job("b", "    name: Build ${{ github.event_name }}\n") +
        job("k", "    name: ${{ vars.KIND }}\n") +
        job("m", "    name: test ${{ matrix.os }}\n"),
    ),
  ];
  const required = ["Build push", "lint"];
  expect(checksOf(files, { ...push, repo: { date, required } })).toEqual({
    "Build push": ["passes", "RQ-4", "WN-2"],
    lint: ["uncertain", "WN-4", "RQ-0"],
  });
  const { verdicts } = simulate(files, { ...push, repo: { date, required } });
  expect(byKey(verdicts, "check › lint")).toMatchObject({
    settle: ["vars.KIND"],
    causes: [
      { rule: "WN-4", spans: [expect.objectContaining({ line: 9 })] },
      {},
    ],
  });
  // Given the variable, only the matrix name stays unknown, and it exists only at run time.
  const given = simulate(files, {
    ...push,
    repo: { date, required, vars: { KIND: "lint" } },
  });
  expect(byKey(given.verdicts, "check › lint")!.value).toBe("passes");
  expect(byKey(given.verdicts, "check › Build push")!.value).toBe("passes");
  const other = simulate(files, {
    ...push,
    repo: { date, required: ["other"], vars: { KIND: "lint" } },
  });
  expect(byKey(other.verdicts, "check › other")).toMatchObject({
    value: "uncertain",
    settle: [],
  });
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
