import { expect, test, type Page } from "@playwright/test";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const row = (page: Page, key: string) =>
  results(page)
    .getByRole("table")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: key, exact: true }) });
const causes = (page: Page) =>
  page
    .getByRole("region", { name: "Explanation" })
    .getByRole("list", { name: "Causes" })
    .locator("> li");

// The demo's Fork target scene (#15 §2, §4).
test("Fork target: on 2026-12-03 triage.yml fails (root PRT-2), and on 2026-12-01 triage.yml › triage fails (root CO-1)", async ({
  page,
}) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await page.getByRole("banner").getByLabel("Compare").check();
  const label = page.getByLabel("Scenario label");
  await label.fill("Fork target");
  await label.press("Enter");
  await page.getByLabel("Event name").fill("pull_request_target");
  await page.getByLabel("Actor kind").selectOption("fork");

  await expect(row(page, "triage.yml").getByRole("cell")).toHaveText([
    "◆ differs",
    "Fork PRskipped",
    "Fork targetfails",
  ]);
  await row(page, "triage.yml").getByRole("button", { name: "fails" }).click();
  await expect(causes(page).first()).toContainText("root PRT-2");
  await expect(causes(page).nth(1)).toContainText("PRT-3");
  for (const fact of [
    "Visibility = public (assumed default)",
    "Created before 2026-09-17 = true (assumed default)",
    "Event policy = none (assumed default)",
  ])
    await expect(
      page.getByRole("region", { name: "Explanation" }),
    ).toContainText(`WN-5: ${fact}`);

  await page.getByLabel("Simulation date").fill("2026-12-01");
  await expect(row(page, "triage.yml").getByRole("cell").nth(2)).toHaveText(
    "Fork targetruns",
  );
  const job = row(page, "triage.yml › triage");
  await expect(job.getByRole("cell").nth(2)).toHaveText("Fork targetfails");
  await job.getByRole("button", { name: "fails" }).click();
  await expect(causes(page).first()).toContainText("root CO-1");
  await expect(causes(page).first()).toContainText(
    "Refusing to check out fork pull request code from a 'pull_request_target' workflow.",
  );
});
