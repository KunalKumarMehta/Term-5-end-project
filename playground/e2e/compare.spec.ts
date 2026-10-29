import { expect, test, type Page } from "@playwright/test";
import { eventForm } from "./forms";

const FILTERED = `on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

const UNFILTERED = `on: push
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: echo lint
`;

async function paste(page: Page, text: string, path: string) {
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(path);
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const grid = (page: Page) => results(page).getByRole("table");
const row = (page: Page, key: string) =>
  grid(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: key, exact: true }) });
const differencesOnly = (page: Page) =>
  results(page).getByLabel("Differences only");

/** Scenario 1 pushes to main; Compare copies it, and Scenario 2 pushes to feature. */
async function compareMainWithFeature(page: Page) {
  await paste(page, FILTERED, ".github/workflows/ci.yml");
  await paste(page, UNFILTERED, ".github/workflows/lint.yml");
  await eventForm(page).getByLabel("Ref").fill("main");
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await page.getByRole("banner").getByLabel("Compare").check();
  await expect(
    page.getByRole("tab", { name: "Scenario 2", selected: true }),
  ).toBeVisible();
  // A full copy of Scenario 1.
  await expect(eventForm(page).getByLabel("Ref")).toHaveValue("main");
  await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-03");
  await eventForm(page).getByLabel("Ref").fill("feature");
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("two push Scenarios mark the branch-filtered GitHub workflow with ◆, and differences only hides the unfiltered one", async ({
  page,
}) => {
  await compareMainWithFeature(page);

  await expect(grid(page).getByRole("columnheader")).toHaveText([
    "",
    "Subject key",
    "Scenario 1",
    "Scenario 2",
  ]);
  await expect(row(page, "ci.yml").getByRole("cell")).toHaveText([
    "◆ differs",
    "Scenario 1runs",
    "Scenario 2skipped",
  ]);
  await expect(row(page, "lint.yml").getByRole("cell")).toHaveText([
    "",
    "Scenario 1runs",
    "Scenario 2runs",
  ]);

  await differencesOnly(page).check();
  await expect(row(page, "ci.yml")).toBeVisible();
  await expect(row(page, "lint.yml")).toHaveCount(0);
  await expect(grid(page)).not.toContainText("lint.yml");
});

test("differences only with no differences says so, and its link turns the filter off", async ({
  page,
}) => {
  await compareMainWithFeature(page);
  await eventForm(page).getByLabel("Ref").fill("main");
  await expect(row(page, "ci.yml")).not.toContainText("◆");

  await differencesOnly(page).check();
  await expect(results(page)).toContainText(
    "No differences: both Scenarios give the same Verdicts",
  );
  await expect(grid(page)).toHaveCount(0);
  await results(page).getByRole("link", { name: "Show every Verdict" }).click();
  await expect(differencesOnly(page)).not.toBeChecked();
  await expect(row(page, "lint.yml")).toBeVisible();
});

test("clearing Scenario 2's date shows the prompt in its column header, — in its cells and no ◆", async ({
  page,
}) => {
  await compareMainWithFeature(page);
  await expect(row(page, "ci.yml")).toContainText("◆");

  await page.getByLabel("Simulation date").fill("");
  const header = grid(page).getByRole("columnheader").nth(3);
  await expect(header).toContainText("Set the simulation date to see Verdicts");
  await expect(row(page, "ci.yml").getByRole("cell")).toHaveText([
    "",
    "Scenario 1runs",
    "Scenario 2—",
  ]);
  await expect(row(page, "lint.yml").getByRole("cell")).toHaveText([
    "",
    "Scenario 1runs",
    "Scenario 2—",
  ]);

  await differencesOnly(page).check();
  await expect(results(page)).toContainText(
    "Scenario 2 has no simulation date, so differences can’t be shown.",
  );

  await differencesOnly(page).uncheck();
  await header.getByRole("link").click();
  await expect(
    page.getByRole("tab", { name: "Scenario 2", selected: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Simulation date")).toBeFocused();
});

test("an unsupported Scenario 2 shows the grey panel in its header and only its event row", async ({
  page,
}) => {
  await compareMainWithFeature(page);
  await eventForm(page).getByLabel("Event name").fill("schedule");

  await expect(grid(page).getByRole("columnheader").nth(3)).toContainText(
    "Unsupported Scenario: Outside v1: WhyNoRun doesn't simulate this Event. (WN-3)",
  );
  await expect(row(page, "event").getByRole("cell")).toHaveText([
    "",
    "Scenario 1—",
    "Scenario 2unsupported",
  ]);
  await expect(row(page, "ci.yml").getByRole("cell")).toHaveText([
    "",
    "Scenario 1runs",
    "Scenario 2—",
  ]);
});

test("a Scenario can't take the other's label, and clearing a label restores Scenario N", async ({
  page,
}) => {
  await compareMainWithFeature(page);
  const label = page.getByLabel("Scenario label");

  await label.fill("Scenario 1");
  await label.press("Enter");
  await expect(page.getByRole("alert")).toHaveText(
    "Scenario 1 already uses this label.",
  );
  await expect(label).toHaveValue("Scenario 2");
  await expect(page.getByRole("tab", { name: "Scenario 2" })).toBeVisible();

  await label.fill("Feature");
  await label.press("Enter");
  await expect(page.getByRole("tab", { name: "Feature" })).toBeVisible();
  await expect(grid(page).getByRole("columnheader").nth(3)).toHaveText(
    "Feature",
  );

  await label.fill("");
  await label.press("Enter");
  await expect(page.getByRole("tab", { name: "Scenario 2" })).toBeVisible();
  await expect(label).toHaveValue("Scenario 2");
});

test("a cell opens that Scenario's Explanation", async ({ page }) => {
  await compareMainWithFeature(page);
  await row(page, "ci.yml")
    .getByRole("button", { name: /skipped/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Explanation" }).getByRole("heading"),
  ).toHaveText("Scenario 2: ci.yml skipped");
});

test("a file with Diagnostics shows as a single file has Diagnostics row", async ({
  page,
}) => {
  await compareMainWithFeature(page);
  await paste(
    page,
    FILTERED.replace("branches", "branchez"),
    ".github/workflows/broken.yml",
  );

  await expect(row(page, "broken.yml").getByRole("cell")).toHaveText([
    "",
    "file has Diagnostics",
  ]);
  await expect(grid(page)).not.toContainText("broken.yml ›");
  await expect(row(page, "ci.yml")).toContainText("◆");
});

test.describe("on a 390 px screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the grid scrolls sideways in its own box, not the page, and the Scenarios stack within each row", async ({
    page,
  }) => {
    const long = `a-${"very-".repeat(12)}long-name.yml`;
    await paste(page, UNFILTERED, `.github/workflows/${long}`);
    const bar = page.getByRole("navigation", { name: "Panes" });
    await bar.getByRole("button", { name: "Scenario" }).click();
    await page.getByLabel("Simulation date").fill("2026-12-03");
    await page.getByRole("banner").getByLabel("Compare").check();
    await bar.getByRole("button", { name: "Results" }).click();

    const box = results(page).locator(".grid-box");
    await expect(row(page, long)).toBeVisible();
    expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);

    const cells = row(page, long).getByRole("cell");
    const one = (await cells.nth(1).boundingBox())!;
    const two = (await cells.nth(2).boundingBox())!;
    expect(two.x).toBe(one.x);
    expect(two.y).toBeGreaterThan(one.y);
  });
});
