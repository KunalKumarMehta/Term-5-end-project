import { expect, test, type Page } from "@playwright/test";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const card = (page: Page, job: string) =>
  results(page).getByRole("region", { name: job, exact: true });
const row = (page: Page, job: string, subject: string) =>
  card(page, job)
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: subject, exact: true }),
    });
const explanation = (page: Page) =>
  page.getByRole("region", { name: "Explanation" });

// The example's Fork PR Scenario, simulated as Load example fills it (#15 §2).
test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await results(page).getByRole("tab", { name: "Access" }).click();
});

test("the Fork PR's ci.yml › test card shows token.pull-requests: read (PERM-2) and secrets: empty (FK-2)", async ({
  page,
}) => {
  await row(page, "ci.yml › test", "pull-requests")
    .getByRole("button", { name: "read" })
    .click();
  await expect(explanation(page).getByRole("heading")).toHaveText(
    "ci.yml › test › token.pull-requests read",
  );
  await expect(explanation(page).getByLabel("Causes")).toContainText(
    "root PERM-2",
  );

  await row(page, "ci.yml › test", "secrets")
    .getByRole("button", { name: "empty" })
    .click();
  await expect(explanation(page).getByRole("heading")).toHaveText(
    "ci.yml › test › secrets empty",
  );
  await expect(explanation(page).getByLabel("Causes")).toContainText(
    "root FK-2",
  );
});

test("Fork PR vs Member PR on the Access tab shows ◆ on token.pull-requests and secrets", async ({
  page,
}) => {
  // #15 §4: Compare on, Scenario 2 renamed Member PR with Actor kind member.
  await page.getByRole("banner").getByLabel("Compare").check();
  const label = page.getByLabel("Scenario label");
  await label.fill("Member PR");
  await label.press("Enter");
  await page.getByLabel("Actor kind").selectOption("member");

  for (const [subject, fork, member] of [
    ["pull-requests", "read", "write"],
    ["secrets", "empty", "available"],
  ]) {
    const r = row(page, "ci.yml › test", subject!);
    await expect(r.getByRole("cell")).toHaveText([
      "◆ differs",
      `Fork PR${fork}`,
      `Member PR${member}`,
    ]);
  }
  // contents is read in both, so it has no ◆.
  await expect(row(page, "ci.yml › test", "contents")).not.toContainText("◆");
});
