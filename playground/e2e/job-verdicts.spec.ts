import { expect, test, type Page } from "@playwright/test";

// The Results' GitHub workflow and job rows, leaving out access keys (#62).
const runRows = (page: Page) =>
  page
    .getByRole("region", { name: "Results" })
    .getByRole("listitem")
    .filter({ hasNotText: / › (token\.|secrets|concurrency\.)/ });

const CI = `on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: echo deploy
  report:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - run: echo report
`;

test('adding "job X fails" in Assumptions turns X\'s row fails and skips its dependents', async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(".github/workflows/ci.yml");
  await dialog.getByLabel("YAML").fill(CI);
  await dialog.getByRole("button", { name: "Add file" }).click();
  await page.getByLabel("Simulation date").fill("2026-12-03");

  const rows = runRows(page);
  await expect(rows).toHaveText([
    "ci.yml runs root EV-0",
    "ci.yml › deploy runs root WN-2",
    "ci.yml › report runs root WN-2",
    "ci.yml › test runs root WN-2",
  ]);

  const scenario = page.getByRole("region", { name: "Scenario" });
  await expect(scenario).toContainText("None.");
  await scenario
    .getByLabel("Assume this job fails")
    .selectOption("ci.yml › test");
  await scenario.getByRole("button", { name: "Add", exact: true }).click();

  await expect(scenario.getByRole("listitem")).toHaveText([
    "job ci.yml › test fails Remove",
  ]);
  await expect(rows).toHaveText([
    "ci.yml runs root EV-0",
    "ci.yml › deploy skipped root WN-1",
    "ci.yml › report skipped root WN-1",
    "ci.yml › test fails root WN-1",
  ]);

  await scenario
    .getByRole("button", { name: "Remove ci.yml › test fails" })
    .click();
  await expect(rows.nth(3)).toHaveText("ci.yml › test runs root WN-2");
});
