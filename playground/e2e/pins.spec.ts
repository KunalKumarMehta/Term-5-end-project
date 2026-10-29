import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import Ajv from "ajv";
import { parse } from "yaml";

const schema = (name: string) =>
  JSON.parse(readFileSync(`schemas/${name}.schema.json`, "utf8")) as object;

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const tab = (page: Page, name: string) =>
  results(page).getByRole("tab", { name, exact: true });
const pin = (page: Page, key: string) =>
  results(page).getByRole("button", { name: `Pin ${key}`, exact: true });
const tray = (page: Page) =>
  results(page).getByRole("button", {
    name: /pinned · Save as Behaviour test…$/,
  });
const saveDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Save as Behaviour test" });
const toast = (page: Page) => page.locator("#toasts");

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
});

test("the demo's four Fork PR pins save as fork-pr.test.yml, valid against the schema, and whynorun test matches every pin", async ({
  page,
}) => {
  // #15 §4, 1:44: settle e2e's output first, so the file carries the Assumption.
  await results(page).locator('.verdicts [data-key="ci.yml › e2e"]').click();
  await page
    .getByRole("region", { name: "Settle it" })
    .getByRole("button", { name: "'true'" })
    .click();

  // 2:34: pin the icons one at a time.
  await tab(page, "Merge readiness").click();
  await pin(page, "check › build").click();
  await pin(page, "check › test").click();
  await tab(page, "Concurrency").click();
  await pin(page, "ci.yml › concurrency.A").click();
  await pin(page, "ci.yml › concurrency.B").click();
  await expect(tray(page)).toHaveText("4 pinned · Save as Behaviour test…");

  await tray(page).click();
  const dialog = saveDialog(page);
  await expect(dialog.getByLabel("Path")).toHaveValue(
    ".github/whynorun/fork-pr.test.yml",
  );
  await expect(dialog).toContainText(
    "WhyNoRun can’t check whether this file already exists in the repo.",
  );
  await expect(dialog).toContainText(
    "Comments aren’t kept here; whynorun test --update keeps them",
  );
  const preview = dialog.getByLabel("Preview");
  await expect(preview).toContainText(
    "# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/whynorun@1/schemas/test-file.schema.json\nversion: 1\ntests:\n  - label: Fork PR\n",
  );
  await expect(preview).toContainText('ci.yml › changes › outputs.src: "true"');

  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("fork-pr.test.yml");
  await expect(toast(page)).toHaveText("Download started: fork-pr.test.yml");
  await expect(dialog).toBeHidden();

  const text = readFileSync(await download.path(), "utf8");
  // Valid against the published schema, read with the YAML 1.2 core schema (#10 §1).
  const file = parse(text, { version: "1.2", schema: "core" }) as {
    tests: { pins: object }[];
  };
  const ajv = new Ajv({ allErrors: true });
  ajv.addSchema(schema("scenario"));
  const valid = ajv.compile(schema("test-file"));
  expect(valid(file), JSON.stringify(valid.errors)).toBe(true);
  expect(Object.keys(file.tests[0]!.pins)).toEqual([
    "check › build",
    "check › test",
    "ci.yml › concurrency.A",
    "ci.yml › concurrency.B",
  ]);

  // Round trip: the same Workflow set, through the CLI.
  const repo = mkdtempSync(join(tmpdir(), "whynorun-pins-"));
  mkdirSync(join(repo, ".github/workflows"), { recursive: true });
  mkdirSync(join(repo, ".github/whynorun"));
  for (const name of ["ci.yml", "deploy.yml", "triage.yml"])
    copyFileSync(
      resolve("playground/src/example", name),
      join(repo, ".github/workflows", name),
    );
  writeFileSync(join(repo, ".github/whynorun/fork-pr.test.yml"), text);
  const run = spawnSync(
    process.execPath,
    [resolve("dist/whynorun.mjs"), "test"],
    { cwd: repo, encoding: "utf8" },
  );
  expect(run.status, run.stdout + run.stderr).toBe(0);
  expect(run.stdout).not.toMatch(/→|not found|Diagnostics/);
});

test("Pin all in this tab pins every Verdict of the tab and says how many were already pinned", async ({
  page,
}) => {
  await tab(page, "Merge readiness").click();
  await pin(page, "check › build").click();
  // Pinning one gets no toast: the icon and the tray are the feedback (#12 §1).
  await expect(toast(page)).toBeEmpty();
  await expect(tray(page)).toHaveText("1 pinned · Save as Behaviour test…");

  await results(page)
    .getByRole("button", { name: "Pin all in this tab" })
    .click();
  await expect(toast(page)).toHaveText("Pinned 1 (1 already pinned)");
  await expect(pin(page, "check › test")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(tray(page)).toHaveText("2 pinned · Save as Behaviour test…");
});

test("each pin toggle has aria-pressed and the label Pin <subject>, and clicking the row opens the Explanation", async ({
  page,
}) => {
  const toggle = pin(page, "ci.yml › test › secrets");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Explanation" })).toHaveCount(
    0,
  );

  await results(page)
    .locator('.verdicts [data-key="ci.yml › test › secrets"]')
    .click();
  await expect(
    page
      .getByRole("region", { name: "Explanation" })
      .getByRole("heading")
      .first(),
  ).toContainText("ci.yml › test › secrets");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(tray(page)).toHaveCount(0);

  // Every tab and the grid carry toggles.
  for (const [name, key] of [
    ["Access", "ci.yml › test › secrets"],
    ["Merge readiness", "check › test"],
    ["Concurrency", "ci.yml › concurrency.A"],
  ] as const) {
    await tab(page, name).click();
    await expect(pin(page, key)).toHaveAttribute("aria-pressed", "false");
  }
  await page.getByRole("banner").getByLabel("Compare").check();
  await tab(page, "All Verdicts").click();
  await expect(pin(page, "ci.yml › test")).toHaveCount(2);
});

test("the default path is <event>-<actor kind> while the label is Scenario N, else the label's slug", async ({
  page,
}) => {
  const label = page.getByLabel("Scenario label");
  await pin(page, "ci.yml").click();
  for (const [typed, path] of [
    ["", "pull_request-fork"],
    ["Fork PR (v2)!", "fork-pr-v2"],
    ["!!!", "behaviour"],
  ] as const) {
    await label.fill(typed);
    await label.press("Enter");
    await tray(page).click();
    await expect(saveDialog(page).getByLabel("Path")).toHaveValue(
      `.github/whynorun/${path}.test.yml`,
    );
    await saveDialog(page).getByRole("button", { name: "Cancel" }).click();
  }
});
