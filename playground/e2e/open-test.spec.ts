import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { parse, stringify } from "yaml";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const header = (page: Page) => page.getByRole("banner");
const tab = (page: Page, name: string) =>
  results(page).getByRole("tab", { name, exact: true });
const pin = (page: Page, key: string) =>
  results(page).getByRole("button", { name: `Pin ${key}`, exact: true });
const tray = (page: Page) =>
  results(page).getByRole("button", {
    name: /pinned · Save as Behaviour test…$/,
  });
const trayStatus = (page: Page) => results(page).locator(".tray-status");
const marks = (page: Page) => results(page).locator(".pin-status");
const opened = (page: Page) =>
  results(page).getByRole("region", { name: "Opened Test file" });
const saveDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Save as Behaviour test" });
const confirm = (page: Page) => page.getByRole("alertdialog");
const toast = (page: Page) => page.locator("#toasts");
const ci = readFileSync("playground/src/example/ci.yml", "utf8");

// The YAML 1.2 core schema both the CLI and the playground read with (#10 §1).
const yaml = (text: string) =>
  parse(text, { version: "1.2", schema: "core" }) as {
    tests: { label: string; pins: Record<string, Record<string, unknown>> }[];
  };

const loadExample = (page: Page) =>
  results(page).getByRole("button", { name: "Load example" }).click();

/** Opens a Test file with the header's Open test… button. */
async function openTest(page: Page, name: string, text: string) {
  const chooser = page.waitForEvent("filechooser");
  await header(page).getByRole("button", { name: "Open test…" }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: "text/yaml", buffer: Buffer.from(text) });
}

/** Pastes over the example's ci.yml. */
async function pasteCi(page: Page, text: string) {
  await header(page).getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(".github/workflows/ci.yml");
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
  await dialog.getByRole("button", { name: "Replace it" }).click();
}

/** Saves the tray and returns the downloaded Test file's name and text. */
async function save(page: Page) {
  await tray(page).click();
  const downloading = page.waitForEvent("download");
  await saveDialog(page).getByRole("button", { name: "Save" }).click();
  const download = await downloading;
  return {
    name: download.suggestedFilename(),
    text: readFileSync(await download.path(), "utf8"),
  };
}

/** #82's demo test (#15 §4, 1:44 and 2:34): settle e2e, pin four Fork PR Verdicts, save. */
async function saveDemo(page: Page) {
  await page.goto("./");
  await loadExample(page);
  await results(page).locator('.verdicts [data-key="ci.yml › e2e"]').click();
  await page
    .getByRole("region", { name: "Settle it" })
    .getByRole("button", { name: "'true'" })
    .click();
  await tab(page, "Merge readiness").click();
  await pin(page, "check › build").click();
  await pin(page, "check › test").click();
  await tab(page, "Concurrency").click();
  await pin(page, "ci.yml › concurrency.A").click();
  await pin(page, "ci.yml › concurrency.B").click();
  const saved = await save(page);
  expect(saved.name).toBe("fork-pr.test.yml");
  return saved.text;
}

const FORK = `{ name: pull_request, actor: fork, ref: feature, base: main, changed: [src/app.ts] }`;

test("re-opening the demo's fork-pr.test.yml waits for a Workflow set, then shows four ✓; editing ci.yml so A isn't cancelled shows changed", async ({
  page,
}) => {
  const text = await saveDemo(page);

  // Order doesn't matter: opened before any Workflow set, the pins wait (#12 §9).
  await page.goto("./");
  await openTest(page, "fork-pr.test.yml", text);
  await expect(toast(page)).toHaveText("Opened fork-pr.test.yml");
  await expect(page.getByLabel("Scenario label")).toHaveValue("Fork PR");
  await expect(opened(page)).toContainText(
    "Fork PR: pins waiting for a Workflow set",
  );
  await expect(trayStatus(page)).toHaveText("0 would fail · 4 waiting");

  // Load example keeps the opened Scenario (#14 §3), and says so first.
  await loadExample(page);
  await expect(confirm(page)).toContainText(
    "Fork PR comes from fork-pr.test.yml, so it won't get the example's Fork PR Scenario.",
  );
  await confirm(page).getByRole("button", { name: "Load example" }).click();
  await expect(marks(page)).toHaveText(Array(4).fill("✓ matches its pin"));
  await expect(trayStatus(page)).toHaveText("0 would fail");
  await expect(opened(page)).not.toContainText("waiting");
  // The first run after Open test stays silent: no tray count was announced.
  await expect(page.locator("#status")).not.toContainText("tray");

  await pasteCi(
    page,
    ci.replace("cancel-in-progress: true", "cancel-in-progress: false"),
  );
  // The mark sits right after the pin's toggle.
  await expect(
    pin(page, "ci.yml › concurrency.A").locator("+ .pin-status"),
  ).toHaveText("changed value cancelled → runs; root CC-2 → CC-1");
  await expect(trayStatus(page)).toHaveText("2 would fail");
  await expect(page.locator("#status")).toContainText("· tray: 2 would fail");
});

test("an invalid Test file loads nothing, and a dialog lists the same file:line: message errors the CLI prints", async ({
  page,
}) => {
  const bad = `version: 1
tests:
  - label: Push
    scenario:
      event: { name: push }
      repo:
        date: 2026-12-03
        vars: { DEPLOY: true }
    pins: {}
`;
  const dir = mkdtempSync(join(tmpdir(), "whynorun-open-"));
  writeFileSync(join(dir, "bad.test.yml"), bad);
  const run = spawnSync(
    process.execPath,
    [resolve("dist/whynorun.mjs"), "test", "bad.test.yml"],
    { cwd: dir, encoding: "utf8" },
  );
  expect(run.status).toBe(2);
  const cli = run.stderr.trim().split("\n");
  expect(cli.length).toBeGreaterThan(1);

  await page.goto("./");
  await loadExample(page);
  await openTest(page, "bad.test.yml", bad);
  const dialog = page.getByRole("alertdialog", {
    name: "Couldn’t open bad.test.yml",
  });
  await expect(dialog.getByRole("listitem")).toHaveText(cli);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Scenario label")).toHaveValue("Fork PR");
  await expect(opened(page)).toHaveCount(0);
  await expect(tray(page)).toHaveCount(0);
});

test("a file with three tests asks which one or two to open, and saving keeps the third verbatim in its place", async ({
  page,
}) => {
  const three = `version: 1
tests:
  - label: One
    scenario:
      event: ${FORK}
      repo: { date: 2026-12-03 }
    pins:
      ci.yml: { value: runs }
  - label: Two
    scenario:
      event: { name: push, ref: refs/heads/main }
      repo: { date: 2026-12-03 }
    pins:
      ci.yml › build: { value: runs, root: WN-2 }
  - label: Three
    scenario:
      event: { name: push, ref: refs/heads/main, payload: { forced: true } }
      repo: { date: 2026-01-01, vars: { FLAG: "true" } }
    pins:
      ci.yml › test: { root: WN-2 }
`;
  await page.goto("./");
  await loadExample(page);
  await openTest(page, "three.test.yml", three);

  const picker = page.getByRole("dialog", { name: "Which tests to open?" });
  await expect(picker.getByRole("button", { name: "Open" })).toBeDisabled();
  await picker.getByLabel("One").check();
  await picker.getByLabel("Two").check();
  await expect(picker.getByLabel("Three")).toBeDisabled();
  await picker.getByRole("button", { name: "Open" }).click();

  await expect(
    page.getByRole("tablist", { name: "Scenarios" }).getByRole("tab"),
  ).toHaveText(["One", "Two"]);
  await expect(header(page).getByLabel("Compare")).toBeChecked();
  await expect(marks(page)).toHaveText(Array(2).fill("✓ matches its pin"));

  await tray(page).click();
  const dialog = saveDialog(page);
  await expect(dialog.getByLabel("Path")).toHaveValue(
    ".github/whynorun/three.test.yml",
  );
  await expect(dialog.getByLabel("Other tests")).toHaveText(
    "Three: unchanged (not opened)",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  const saved = await save(page);
  expect(saved.name).toBe("three.test.yml");

  const before = yaml(three);
  const after = yaml(saved.text);
  expect(after.tests.map((t) => t.label)).toEqual(["One", "Two", "Three"]);
  expect(after.tests[2]).toEqual(before.tests[2]);
  // A matching loaded pin keeps its own field list.
  expect(after.tests[1]!.pins).toEqual(before.tests[1]!.pins);
});

test("a loaded pin whose root the Maintainer deleted stays loose when saved", async ({
  page,
}) => {
  const demo = yaml(await saveDemo(page));
  delete demo.tests[0]!.pins["ci.yml › concurrency.A"]!.root;
  const loose = stringify(demo, { version: "1.2", schema: "core" });

  await page.goto("./");
  await loadExample(page);
  await openTest(page, "fork-pr.test.yml", loose);
  await pasteCi(
    page,
    ci.replace("cancel-in-progress: true", "cancel-in-progress: false"),
  );
  await expect(trayStatus(page)).toHaveText("2 would fail");

  const saved = yaml((await save(page)).text);
  const a = saved.tests[0]!.pins["ci.yml › concurrency.A"]!;
  expect(a.value).toBe("runs");
  expect(a).not.toHaveProperty("root");
  // A pin that kept its root is rewritten with the new one.
  expect(saved.tests[0]!.pins["ci.yml › concurrency.B"]).toHaveProperty("root");
});

test("a pin whose subject was renamed offers candidates and Remove pin, with already-pinned candidates disabled; a renamed assumed job is marked in the form", async ({
  page,
}) => {
  const renamed = `version: 1
tests:
  - label: Fork PR
    scenario:
      event: ${FORK}
      repo: { date: 2026-12-03 }
      assume: { "ci.yml › test": fails }
    pins:
      ci.yml › build: { value: runs }
      ci.yml › test: { value: fails }
`;
  await page.goto("./");
  await loadExample(page);
  await openTest(page, "renamed.test.yml", renamed);
  await expect(marks(page)).toHaveText(Array(2).fill("✓ matches its pin"));

  await pasteCi(page, ci.replace("\n  test:\n", "\n  unit:\n"));
  const row = opened(page).getByRole("listitem").filter({
    hasText: "ci.yml › test pin not found",
  });
  await expect(row).toContainText("Fork PR: ci.yml › test pin not found");
  const build = row.getByRole("button", { name: "ci.yml › build" });
  await expect(build).toBeDisabled();
  await expect(build).toHaveText("ci.yml › build (already pinned)");
  await expect(
    row.getByRole("button", { name: "ci.yml › unit" }),
  ).toBeEnabled();
  await expect(row.getByRole("button", { name: "Remove pin" })).toBeVisible();

  // The Assumption on the renamed job is marked in the form (#12 §9).
  const assumptions = page.getByRole("group", { name: "Assumptions" });
  await expect(assumptions).toContainText("assumed subject not found");
  await expect(
    assumptions.getByRole("button", { name: "ci.yml › unit" }),
  ).toBeEnabled();

  // The clash resolved, the candidate is clickable again (addendum G).
  await pin(page, "ci.yml › build").click();
  await expect(build).toBeEnabled();
  await row.getByRole("button", { name: "ci.yml › unit" }).click();
  await expect(row).toHaveCount(0);
  await expect(pin(page, "ci.yml › unit")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await assumptions.getByRole("button", { name: "ci.yml › unit" }).click();
  await expect(assumptions).not.toContainText("assumed subject not found");
  await expect(assumptions).toContainText("job ci.yml › unit fails");
});

test("Open test over pins asks first, naming what it loses; Keep my draft keeps them and focus moves to the Workflow set source", async ({
  page,
}) => {
  const one = `version: 1
tests:
  - label: Opened
    scenario:
      event: ${FORK}
      repo: { date: 2026-12-03 }
    pins:
      ci.yml: { value: runs }
`;
  await page.goto("./");
  await loadExample(page);
  await pin(page, "ci.yml › build").click();

  await openTest(page, "one.test.yml", one);
  await expect(confirm(page)).toContainText(
    "It replaces your 1 pinned Verdict.",
  );
  await expect(
    confirm(page).getByRole("button", { name: "Keep my draft" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#set-source")).toBeFocused();
  await expect(page.getByLabel("Scenario label")).toHaveValue("Fork PR");

  await openTest(page, "one.test.yml", one);
  await confirm(page).getByRole("button", { name: "Open test" }).click();
  await expect(page.getByLabel("Scenario label")).toHaveValue("Opened");
  await expect(tray(page)).toHaveText("1 pinned · Save as Behaviour test…");

  // Opening again with the opened pins unchanged asks nothing; a new pin changes them.
  await pin(page, "ci.yml › build").click();
  await openTest(page, "one.test.yml", one);
  await expect(confirm(page)).toContainText(
    "It drops your changes to the pins from one.test.yml.",
  );
});
