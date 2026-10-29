import { expect, test, type Page } from "@playwright/test";
import { eventForm } from "./forms";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const row = (page: Page, key: string) =>
  results(page)
    .locator(".verdicts")
    .getByRole("listitem")
    .filter({ has: page.locator(".key").getByText(key, { exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
});

test("Load example fills the ref, the base branch and the changed files of the Fork PR Scenario", async ({
  page,
}) => {
  await expect(eventForm(page).getByLabel("Ref")).toHaveValue("feature");
  await expect(eventForm(page).getByLabel("Base branch")).toHaveValue("main");
  await expect(eventForm(page).getByLabel("Changed files")).toHaveValue(
    "src/app.ts",
  );
  await expect(eventForm(page).getByLabel("Head commit message")).toHaveValue(
    "",
  );
});

test("a member's docs-only pull_request skips ci.yml at its paths: line, and a skip instruction skips it too", async ({
  page,
}) => {
  await eventForm(page).getByLabel("Actor kind").selectOption("member");
  await expect(row(page, "ci.yml")).toHaveText("ci.yml runs root PA-2");

  await eventForm(page).getByLabel("Changed files").fill("docs/README.md");
  await expect(row(page, "ci.yml")).toHaveText("ci.yml skipped root PA-2");
  await row(page, "ci.yml").getByRole("button").click();
  await expect(page.getByRole("list", { name: "Causes" })).toContainText(
    "ci.yml:5",
  );
  await page
    .getByRole("link", { name: "Changed files = docs/README.md" })
    .click();
  await expect(eventForm(page).getByLabel("Changed files")).toBeFocused();

  // One path per line, taken as the complete diff.
  await eventForm(page)
    .getByLabel("Changed files")
    .fill("docs/README.md\nsrc/app.ts");
  await expect(row(page, "ci.yml")).toHaveText("ci.yml runs root PA-2");
  await eventForm(page)
    .getByLabel("Head commit message")
    .fill("Tidy up [skip ci]");
  await expect(row(page, "ci.yml")).toHaveText("ci.yml skipped root SK-1");
});
