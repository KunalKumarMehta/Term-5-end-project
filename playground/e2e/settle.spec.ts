import { expect, test, type Page } from "@playwright/test";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const explanation = (page: Page) =>
  page.getByRole("region", { name: "Explanation" });
const settleIt = (page: Page) =>
  explanation(page).getByRole("region", {
    name: "Settle it",
  });
const row = (page: Page, key: string) =>
  results(page)
    .getByRole("table")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: key, exact: true }) });
const listed = (page: Page, key: string) =>
  results(page).locator(`.verdicts [data-key="${key}"]`);

async function paste(page: Page, text: string) {
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(".github/workflows/ci.yml");
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("settling the example's ci.yml › e2e in Scenario 1 makes it run there, while Scenario 2 stays Uncertain", async ({
  page,
}) => {
  await results(page).getByRole("button", { name: "Load example" }).click();
  await page.getByRole("banner").getByLabel("Compare").check();
  await expect(row(page, "ci.yml › e2e").getByRole("cell")).toHaveText([
    "",
    "Fork PRuncertain (runs, skipped)",
    "Scenario 2uncertain (runs, skipped)",
  ]);

  await row(page, "ci.yml › e2e").getByRole("button").first().click();
  await expect(explanation(page).getByRole("heading").first()).toHaveText(
    "Fork PR: ci.yml › e2e uncertain",
  );
  await expect(explanation(page).getByLabel("Causes")).toContainText(
    "root WN-4",
  );
  await expect(settleIt(page)).toContainText(
    "ci.yml › changes › outputs.src: output src of dorny/paths-filter in job changes",
  );
  await settleIt(page).getByRole("button", { name: "'true'" }).click();

  await expect(row(page, "ci.yml › e2e").getByRole("cell")).toHaveText([
    "◆ differs",
    "Fork PRruns",
    "Scenario 2uncertain (runs, skipped)",
  ]);
  await expect(page.locator("#toasts")).toHaveText(
    "Settled ci.yml › changes › outputs.src = 'true' in Fork PR",
  );
  await expect(page.locator("#status")).toHaveText(
    "Results updated: 1 Verdict changed",
  );
  // The value sits with the Assumptions of Scenario 1 only.
  await page.getByRole("tab", { name: "Fork PR" }).click();
  await expect(
    page.getByRole("list").filter({ hasText: "outputs.src" }),
  ).toHaveText("ci.yml › changes › outputs.src = 'true' Remove");
});

test("an Uncertain Verdict with an empty settle says nothing you can enter decides it, and why", async ({
  page,
}) => {
  await paste(
    page,
    "on:\n  push:\n    branches: ['refs/heads/main']\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n",
  );
  await page.getByLabel("Ref").fill("main");
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await listed(page, "ci.yml").click();
  await expect(settleIt(page)).toHaveText(
    "Settle itNothing you can enter decides this: a gap in GitHub's docs (BR-8).",
  );
});

const GATED = `on: push
jobs:
  release:
    if: github.repository == 'acme/app' && contains(github.event.commits.*.message, 'release')
    runs-on: x
    steps:
      - run: echo
  lint:
    if: github.workflow == 'CI'
    runs-on: x
    steps:
      - run: echo
`;

test("owner/repo is checked wherever it's entered, a list path takes one value per line, and a run-time-only value can't be settled", async ({
  page,
}) => {
  await paste(page, GATED);
  await page.getByLabel("Simulation date").fill("2026-12-03");
  const release = listed(page, "ci.yml › release");
  await expect(release).toContainText("uncertain (runs, skipped)");

  // The form's field: a refused value changes nothing and says how to write it.
  const field = page.getByLabel("owner/repo (optional)");
  await field.fill("acme");
  await expect(
    page.getByRole("alert").filter({ hasText: "owner/repo" }),
  ).toHaveText("Use the form owner/repo, e.g. acme/app");
  await field.fill("acme/app");
  await expect(
    page.getByRole("alert").filter({ hasText: "owner/repo" }),
  ).toHaveCount(0);
  await release.click();
  await expect(settleIt(page)).not.toContainText("repo.repository");

  // The list path: one value per line, stored as a list of objects.
  const box = settleIt(page);
  await box.getByLabel("Values, one per line").fill("fix typo\nrelease");
  await box.getByRole("button", { name: "Settle" }).click();
  await expect(release).toContainText("runs");
  await expect(page.locator("#toasts")).toHaveText(
    "Settled github.event.commits.*.message = ['fix typo', 'release'] in Scenario 1",
  );
  await expect(
    page.getByRole("list", { name: "Event payload values" }),
  ).toHaveText(
    'github.event.commits = [{"message":"fix typo"}, {"message":"release"}] Remove',
  );

  // Clearing owner/repo unsets it, so the comparison is Uncertain again.
  await field.fill("");
  await expect(release).toContainText("uncertain");
  await release.click();
  await settleIt(page).getByLabel("Another value").fill("acme");
  await settleIt(page).getByRole("button", { name: "Settle" }).click();
  await expect(settleIt(page).getByRole("alert")).toHaveText(
    "Use the form owner/repo, e.g. acme/app",
  );
  await expect(release).toContainText("uncertain");

  await listed(page, "ci.yml › lint").click();
  await expect(settleIt(page)).toHaveText(
    "Settle itNothing you can enter decides this: the value exists only at run time.",
  );
});

test("a typed event policy that isn't allowed is refused inline and leaves the Scenario as it was", async ({
  page,
}) => {
  await paste(
    page,
    "on: pull_request_target\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n",
  );
  await page.getByLabel("Event name").fill("pull_request_target");
  await page.getByLabel("Created before 2026-09-17").selectOption("no");
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await listed(page, "ci.yml").click();
  await expect(listed(page, "ci.yml")).toContainText("uncertain");

  await settleIt(page).getByLabel("Another value").fill("maybe");
  await settleIt(page).getByRole("button", { name: "Settle" }).click();
  await expect(settleIt(page).getByRole("alert")).toContainText(
    "repo.eventPolicy can't be 'maybe'",
  );
  await expect(listed(page, "ci.yml")).toContainText("uncertain");
  await expect(page.getByText(/internal error/)).toHaveCount(0);

  // Its job's box offers the same one-click values.
  await listed(page, "ci.yml › a").click();
  await settleIt(page).getByRole("button", { name: "'blocks'" }).click();
  await expect(listed(page, "ci.yml")).toContainText("fails");
});

test("with only called workflows, the empty Verdict list says they appear under their callers", async ({
  page,
}) => {
  await paste(
    page,
    "on: workflow_call\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n",
  );
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await expect(results(page)).toContainText(
    "No Verdicts: every file is only a called workflow (on: workflow_call), and its jobs appear under the jobs that call it.",
  );
});
