import { expect, test } from "vitest";
import {
  setScenarioValue,
  simulate,
  validateScenario,
  withDefaults,
  type Scenario,
} from "./index";

// #10 §2's illustrative Test file entry, renamed to the schema's field names.
const example = {
  event: {
    name: "pull_request_target",
    type: "opened",
    actor: "fork",
    approval: "approved",
    ref: "feature",
    base: "main",
    changed: ["src/a.ts"],
    payload: {},
  },
  repo: {
    date: "2026-12-03",
    visibility: "public",
    predates: true,
    tokenDefault: "restricted",
    eventPolicy: "none",
    defaultBranch: "main",
    required: ["test"],
    strict: false,
    mergeQueue: false,
    vars: {},
  },
  assume: {},
};

test("the schema accepts a Scenario shaped like the Test file example", () => {
  expect(validateScenario(example)).toEqual([]);
  expect(
    validateScenario({
      ...example,
      repo: { ...example.repo, repository: "acme/app.js" },
      event: {
        ...example.event,
        login: "octocat",
        payload: { pull_request: { draft: false, labels: [{ name: "safe" }] } },
      },
      followUp: { name: "push", runA: "pending", pendingRuns: 2, payload: {} },
      assume: {
        "ci.yml › test": "fails",
        "ci.yml › changes › outputs.src": "true",
      },
    }),
  ).toEqual([]);
});

test.each(["acme", "acme/app/x", "-acme/app", "acme/..", "acme/a b", "/app"])(
  "the schema rejects the malformed owner/repo %j",
  (repository) => {
    const errors = validateScenario({
      ...example,
      repo: { ...example.repo, repository },
    });
    expect(errors).toEqual([expect.stringContaining("/repo/repository")]);
  },
);

test("the schema rejects a Scenario without a simulation date, and simulate() refuses it", () => {
  const noDate = { event: { name: "push" }, repo: {} } as unknown as Scenario;
  expect(validateScenario(noDate)).not.toEqual([]);
  expect(() => simulate([], noDate)).toThrow(TypeError);
});

test("the defaults function fills a minimal Scenario completely and lists every field it filled", () => {
  const { scenario, filled } = withDefaults({
    event: { name: "push" },
    repo: { date: "2026-12-03" },
  });
  expect(JSON.parse(JSON.stringify(scenario))).toEqual({
    event: {
      name: "push",
      actor: "member",
      approval: "approved",
      changed: [],
      payload: {},
    },
    repo: {
      date: "2026-12-03",
      visibility: "public",
      predates: true,
      tokenDefault: "restricted",
      eventPolicy: "none",
      defaultBranch: "main",
      required: [],
      strict: false,
      mergeQueue: false,
      vars: {},
    },
    assume: {},
  });
  expect(validateScenario(scenario)).toEqual([]);
  expect([...filled].sort()).toEqual(
    [
      "event.actor",
      "event.approval",
      "event.changed",
      "event.payload",
      "repo.visibility",
      "repo.predates",
      "repo.tokenDefault",
      "repo.eventPolicy",
      "repo.defaultBranch",
      "repo.required",
      "repo.strict",
      "repo.mergeQueue",
      "repo.vars",
      "assume",
    ].sort(),
  );
});

test("the defaults function keeps given fields, fills a Follow-up event's own defaults, and fills nothing in a complete Scenario", () => {
  const { scenario, filled } = withDefaults({
    ...example,
    followUp: { name: "push" },
  } as Scenario);
  expect(scenario.event.actor).toBe("fork");
  expect(scenario.followUp).toEqual({
    name: "push",
    actor: "member",
    approval: "approved",
    changed: [],
    payload: {},
    runA: "in-progress",
    pendingRuns: 0,
  });
  expect(filled.every((f) => f.startsWith("followUp."))).toBe(true);
  expect(withDefaults(scenario).filled).toEqual([]);
});

test.each([
  [["event", "payload", "__proto__", "x"]],
  [["repo", "vars", "__proto__"]],
  [["repo", "vars", "constructor"]],
  [["event", "payload", "constructor", "prototype", "x"]],
  [["assume", "prototype"]],
])("the settle path-setter refuses %j", (path) => {
  const scenario = withDefaults(example as Scenario).scenario;
  expect(() => setScenarioValue(scenario, path, "polluted")).toThrow();
  expect(({} as Record<string, unknown>).x).toBeUndefined();
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});

test("the settle path-setter sets a value, creating the objects on its path, and leaves the input alone", () => {
  const before = withDefaults(example as Scenario).scenario;
  const after = setScenarioValue(
    setScenarioValue(
      before,
      ["event", "payload", "pull_request", "draft"],
      false,
    ),
    ["assume", "ci.yml › changes › outputs.src"],
    "true",
  );
  expect(after.event.payload).toEqual({ pull_request: { draft: false } });
  expect(after.assume).toEqual({ "ci.yml › changes › outputs.src": "true" });
  expect(before.event.payload).toEqual({});
});
