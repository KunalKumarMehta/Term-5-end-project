import type { Scenario, WorkflowFile } from "../../../src/core";
import ci from "./ci.yml?raw";
import deploy from "./deploy.yml?raw";
import triage from "./triage.yml?raw";

/** The bundled example Workflow set behind Load example (#15 §2). */
export const EXAMPLE_FILES: readonly WorkflowFile[] = [
  { path: ".github/workflows/ci.yml", text: ci },
  { path: ".github/workflows/deploy.yml", text: deploy },
  { path: ".github/workflows/triage.yml", text: triage },
];

export const EXAMPLE_LABEL = "Fork PR";

// A fork contributor's PR touching src, then a second push to the same PR (#15 §2, amending #12 §2).
export const EXAMPLE_SCENARIO: Scenario = {
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
};
