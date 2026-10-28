import { expect, test, type Page } from "@playwright/test";

const CI = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

const DOCS = `name: Docs
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo docs
`;

const EV_0 =
  "A run is created only for GitHub workflows whose on: lists the triggering event; an event not listed creates no run.";

async function paste(page: Page, text: string, path: string) {
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(path);
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const explanation = (page: Page) =>
  page.getByRole("region", { name: "Explanation" });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await paste(page, DOCS, ".github/workflows/docs.yml");
  await paste(page, CI, ".github/workflows/ci.yml");
});

test("clicking a Verdict opens its cause chain with the root marked, the rule's text, its YAML and inputs", async ({
  page,
}) => {
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await results(page)
    .getByRole("button", { name: "ci.yml runs root EV-0" })
    .click();

  const panel = explanation(page);
  await expect(panel.getByRole("heading")).toHaveText("ci.yml runs");
  const causes = panel.getByRole("list", { name: "Causes" }).locator("> li");
  await expect(causes).toHaveCount(1);
  await expect(causes.first()).toContainText(`root EV-0: ${EV_0}`);
  // One line of context either side; line 1 has nothing above it.
  await expect(causes.first().locator("pre")).toHaveText("1on: push\n2jobs:");
  await expect(causes.first().locator("mark")).toHaveText("on: push");

  await panel.getByRole("link", { name: "Event name = push" }).click();
  await expect(page.getByLabel("Event name")).toBeFocused();

  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
  await expect(
    results(page).getByRole("button", { name: "ci.yml runs root EV-0" }),
  ).toBeFocused();
});

test("a cause's file:line link switches to that file's tab and highlights its on: line", async ({
  page,
}) => {
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await expect(page.getByRole("tab", { name: "ci.yml" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await results(page)
    .getByRole("button", { name: "docs.yml skipped root EV-0" })
    .click();
  await explanation(page).getByRole("link", { name: "docs.yml:2" }).click();

  await expect(page.getByRole("tab", { name: "docs.yml" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".cm-line.highlighted")).toHaveText(["on:"]);
});

test.describe("on a 390 px screen", () => {
  // Short enough that the sheet scrolls.
  test.use({ viewport: { width: 390, height: 240 } });

  test("the Explanation is a full-screen sheet that keeps its place across a file:line jump", async ({
    page,
  }) => {
    const bar = page.getByRole("navigation", { name: "Panes" });
    await bar.getByRole("button", { name: "Scenario" }).click();
    await page.getByLabel("Simulation date").fill("2026-12-03");
    await bar.getByRole("button", { name: "Results" }).click();
    await results(page)
      .getByRole("button", { name: "docs.yml skipped root EV-0" })
      .click();

    const sheet = explanation(page);
    expect(await sheet.boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 240,
    });
    const link = sheet.getByRole("link", { name: "docs.yml:2" });
    // Scrolled to the end, which still leaves the link in view, so clicking it scrolls nothing.
    await sheet.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const scrolled = await sheet.evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
    await expect(link).toBeInViewport();

    await link.click();
    await expect(bar.getByRole("button", { name: "YAML" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".cm-line.highlighted")).toHaveText(["on:"]);

    await bar.getByRole("button", { name: "Results" }).click();
    await expect(sheet.getByRole("heading")).toHaveText("docs.yml skipped");
    expect(await sheet.evaluate((el) => el.scrollTop)).toBe(scrolled);
  });
});
