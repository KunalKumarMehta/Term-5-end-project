import { expect, test, type Page } from "@playwright/test";
import { eventForm } from "./forms";

declare global {
  interface Window {
    said: string[];
  }
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });

// All Verdicts' GitHub workflow and job rows, leaving out access keys (#62) and checks (#71).
const runRows = (page: Page) =>
  results(page)
    .locator(".verdicts")
    .getByRole("listitem")
    .filter({ hasNotText: /^check › | › (token\.|secrets|concurrency\.)/ });
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
  await expect(eventForm(page).getByLabel("Event name")).toHaveValue(
    "pull_request",
  );
  await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-03");
  // The fork contributor's pull_request is simulated (#64).
  await expect(results(page)).not.toContainText("Unsupported Scenario");
  await expect(runRows(page).first()).toHaveText("ci.yml runs root PA-2");
});

test("Load example's Scenario shows Actor kind fork contributor and Approval approved (assumed); the Approval field disappears for a member", async ({
  page,
}) => {
  await results(page).getByRole("button", { name: "Load example" }).click();
  const actor = eventForm(page).getByLabel("Actor kind");
  await expect(actor.locator("option:checked")).toHaveText("Fork contributor");
  const approval = eventForm(page).getByRole("combobox", { name: "Approval" });
  await expect(approval).toHaveValue("approved");
  await expect(approval).toHaveAccessibleDescription("assumed");
  await expect(page.locator("label[for=event-approval]")).toHaveText(
    "Approval assumed",
  );

  // Changing it makes it set, and awaiting makes ci.yml pending (root FK-4).
  await approval.selectOption("awaiting");
  await expect(approval).toHaveAccessibleDescription("set");
  await expect(runRows(page).first()).toHaveText("ci.yml pending root FK-4");

  await actor.selectOption("member");
  await expect(approval).toHaveCount(0);
});

test("editing a file marks the example edited, and Reset asks first, then restores the files silently", async ({
  page,
}) => {
  // A member's push, with Scenario 1 touched so Load example keeps it.
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await confirm(page).getByRole("button", { name: "Load example" }).click();
  await expect(source(page)).toHaveText("Example");
  const rows = runRows(page);
  const all = [
    "ci.yml runs root BR-4",
    "ci.yml › build runs root WN-2",
    "ci.yml › changes runs root WN-2",
    "ci.yml › e2e uncertain (runs, skipped) root WN-4",
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
  await expect(eventForm(page).getByLabel("Event name")).toHaveValue("push");
  await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-01");
  await expect(runRows(page)).toHaveText([
    "ci.yml runs root BR-4",
    "ci.yml › build runs root WN-2",
    "ci.yml › changes runs root WN-2",
    "ci.yml › e2e uncertain (runs, skipped) root WN-4",
    "ci.yml › test runs root WN-2",
    "deploy.yml runs root BR-4",
    "deploy.yml › deploy runs root WN-2",
    "triage.yml skipped root EV-0",
    "triage.yml › triage no-run root EV-0",
  ]);
});
