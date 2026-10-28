import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    said: string[];
  }
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const header = (page: Page) => page.getByRole("banner");
const source = (page: Page) => page.locator("#set-source");
const confirm = (page: Page) => page.getByRole("alertdialog");
const scenarioTabs = (page: Page) =>
  page.getByRole("tablist", { name: "Scenarios" }).getByRole("tab");

test.beforeEach(async ({ page }) => {
  // Record every text the status region takes, from before load.
  await page.addInitScript(() => {
    window.said = [];
    document.addEventListener("DOMContentLoaded", () => {
      const status = document.getElementById("status")!;
      new MutationObserver(() => {
        if (status.textContent) window.said.push(status.textContent);
      }).observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  });
  await page.goto("./");
});

test("Load example loads the three files and fills Scenario 1 with the Fork PR Scenario", async ({
  page,
}) => {
  await expect(
    page
      .getByRole("region", { name: "YAML" })
      .getByRole("button", { name: "Load example" }),
  ).toBeEnabled();
  await results(page).getByRole("button", { name: "Load example" }).click();

  await expect(confirm(page)).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Files" })).toHaveText(
    "ci.ymldeploy.ymltriage.yml",
  );
  await expect(source(page)).toHaveText("Example");
  await expect(source(page)).toBeFocused();
  await expect(page.locator("#toasts")).toHaveText("Loaded the example");
  await expect(scenarioTabs(page)).toHaveText(["Fork PR"]);
  await expect(page.getByLabel("Event name")).toHaveValue("pull_request");
  await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-03");
  // Interim: a fork contributor's pull_request is simulated from #64 on.
  await expect(results(page)).toContainText("Unsupported Scenario");
  await expect(results(page)).toContainText("Actor kind = fork");
});

test("editing a file marks the example edited, and Reset asks first, then restores the files silently", async ({
  page,
}) => {
  // A member's push, so the files get Verdicts until fork contributors land with #64.
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await confirm(page).getByRole("button", { name: "Load example" }).click();
  await expect(source(page)).toHaveText("Example");
  const rows = results(page).locator(".verdicts").getByRole("listitem");
  const all = [
    "ci.yml runs root BR-4",
    "ci.yml › build runs root WN-2",
    "ci.yml › changes runs root WN-2",
    "ci.yml › e2e skipped root JG-3",
    "ci.yml › test runs root WN-2",
    "deploy.yml runs root BR-4",
    "deploy.yml › deploy runs root WN-2",
    "triage.yml skipped root EV-0",
    "triage.yml › triage no-run root EV-0",
  ];
  await expect(rows).toHaveText(all);

  // Two files lose their jobs, so get Diagnostics, one run at a time: the last announcement
  // is deploy.yml's, and a Reset that spoke would say something new (both "cleared").
  const broken: string[] = [];
  for (const name of ["ci.yml", "deploy.yml"]) {
    broken.push(name);
    await page.getByRole("tab", { name }).click();
    await page
      .getByRole("textbox", { name: `YAML of .github/workflows/${name}` })
      .click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("on: pull_request");
    await expect(rows).toHaveText(
      all.filter((row) => !broken.includes(row.split(" ")[0]!)),
    );
  }
  await expect(source(page)).toHaveText("Example · edited");
  const editor = page.getByRole("textbox", {
    name: "YAML of .github/workflows/deploy.yml",
  });

  // Escape counts as Keep my draft.
  await header(page).getByRole("button", { name: "Reset" }).click();
  await expect(confirm(page)).toContainText(
    "It replaces your edits to the example files.",
  );
  await expect(
    confirm(page).getByRole("button", { name: "Keep my draft" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm(page)).toHaveCount(0);
  await expect(source(page)).toBeFocused();
  await expect(source(page)).toHaveText("Example · edited");

  await expect(page.locator("#status")).toHaveText(
    "· deploy.yml has 1 Diagnostic",
  );
  await page.evaluate(() => window.said.splice(0));
  await header(page).getByRole("button", { name: "Reset" }).click();
  await confirm(page).getByRole("button", { name: "Reset" }).click();
  await expect(confirm(page)).toHaveCount(0);
  await expect(source(page)).toHaveText("Example");
  await expect(source(page)).toBeFocused();
  await expect(editor).toContainText("name: Deploy");
  await expect(rows).toHaveText(all);
  await expect(page.locator("#toasts")).toHaveText("Reset to example files");
  // #12 addendum E: the first run after a wholesale replacement stays silent.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.said)).toEqual([]);
});

test("with Scenario 1 touched, Load example asks first, then loads the files and leaves the Scenario as it was", async ({
  page,
}) => {
  await page.getByLabel("Simulation date").fill("2026-12-01");
  await results(page).getByRole("button", { name: "Load example" }).click();

  await expect(confirm(page)).toContainText(
    "Scenario 1 keeps your changes, so it won't get the example's Fork PR Scenario.",
  );
  // Tapping outside counts as Keep my draft.
  await page.mouse.click(5, 5);
  await expect(confirm(page)).toHaveCount(0);
  await expect(results(page)).toContainText("No Workflow set yet");

  await results(page).getByRole("button", { name: "Load example" }).click();
  await confirm(page).getByRole("button", { name: "Load example" }).click();
  await expect(confirm(page)).toHaveCount(0);
  await expect(source(page)).toHaveText("Example");
  await expect(source(page)).toBeFocused();
  await expect(scenarioTabs(page)).toHaveText(["Scenario 1"]);
  await expect(page.getByLabel("Event name")).toHaveValue("push");
  await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-01");
  await expect(results(page).getByRole("listitem")).toHaveText([
    "ci.yml runs root BR-4",
    "ci.yml › build runs root WN-2",
    "ci.yml › changes runs root WN-2",
    "ci.yml › e2e skipped root JG-3",
    "ci.yml › test runs root WN-2",
    "deploy.yml runs root BR-4",
    "deploy.yml › deploy runs root WN-2",
    "triage.yml skipped root EV-0",
    "triage.yml › triage no-run root EV-0",
  ]);
});
