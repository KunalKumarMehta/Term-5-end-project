import { expect, test, type Page } from "@playwright/test";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const scenarioPane = (page: Page) =>
  page.getByRole("region", { name: "Scenario" });
const chips = (page: Page, where: ReturnType<typeof results>) =>
  where.getByRole("list", { name: "Required checks" }).getByRole("listitem");
const checkRow = (page: Page, key: string) =>
  results(page)
    .getByRole("table")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: key, exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await results(page).getByRole("tab", { name: "Merge readiness" }).click();
});

test("Load example shows the required checks build and test as chips, in Repo facts and at the top of the Merge readiness tab", async ({
  page,
}) => {
  for (const where of [scenarioPane(page), results(page)])
    await expect(chips(page, where)).toHaveText([/^build/, /^test/]);
  await expect(checkRow(page, "check › build")).toContainText("passes");
  await expect(checkRow(page, "check › test")).toContainText("passes");
});

test("in Member PR, a docs-only change makes both checks Pending and blocks merge, rooted in RQ-1, with ◆ against Fork PR", async ({
  page,
}) => {
  // #15 §4 segment 1:10.
  await page.getByRole("banner").getByLabel("Compare").check();
  const label = page.getByLabel("Scenario label");
  await label.fill("Member PR");
  await label.press("Enter");
  await page
    .getByRole("group", { name: "Event", exact: true })
    .getByLabel("Actor kind")
    .selectOption("member");
  await page
    .getByRole("group", { name: "Event", exact: true })
    .getByLabel("Changed files")
    .fill("docs/README.md");

  for (const key of ["check › build", "check › test"])
    await expect(checkRow(page, key).getByRole("cell")).toHaveText([
      "◆ differs",
      "Fork PRpasses",
      "Member PRpending and blocks merge",
    ]);
  await checkRow(page, "check › test")
    .getByRole("button", { name: "pending and blocks merge" })
    .click();
  const causes = page
    .getByRole("region", { name: "Explanation" })
    .getByLabel("Causes");
  await expect(causes).toContainText("root RQ-1");
  await expect(causes).toContainText("ci.yml:5");
  await expect(causes).toContainText("Avoid requiring workflows");

  // The All Verdicts grid's Required checks group holds the same rows.
  await results(page).getByRole("tab", { name: "All Verdicts" }).click();
  await expect(checkRow(page, "check › build").getByRole("cell")).toHaveText([
    "◆ differs",
    "Fork PRpasses",
    "Member PRpending and blocks merge",
  ]);
});

test("adding test twice flashes its chip and announces it, and the input clears; a trimmed new name adds a chip and × removes it", async ({
  page,
}) => {
  const input = results(page).getByLabel("Add a required check");
  await input.fill("test");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  const test = chips(page, results(page)).filter({ hasText: /^test/ });
  await expect(test).toHaveClass(/flash/);
  await expect(page.locator("#status")).toHaveText("test is already required");
  await expect(chips(page, results(page))).toHaveCount(2);

  // Trimmed at the ends; an empty name adds nothing.
  await input.fill("  lint  ");
  await input.press("Enter");
  await input.fill("   ");
  await input.press("Enter");
  await expect(chips(page, results(page))).toHaveText([
    /^build/,
    /^test/,
    /^lint/,
  ]);
  await expect(checkRow(page, "check › lint")).toContainText(
    "pending and blocks merge",
  );
  await results(page).getByRole("button", { name: "Remove lint" }).click();
  await expect(chips(page, results(page))).toHaveCount(2);
});

test("with no required checks the tab says so, and strict mode adds RQ-10 to the Explanation", async ({
  page,
}) => {
  for (const name of ["build", "test"])
    await results(page)
      .getByRole("button", { name: `Remove ${name}` })
      .click();
  await expect(results(page)).toContainText(
    "No required checks yet, so no check can block merge. Add names above.",
  );

  const input = results(page).getByLabel("Add a required check");
  await input.fill("build");
  await input.press("Enter");
  await results(page).getByLabel("Mode").selectOption("strict");
  await expect(scenarioPane(page).getByLabel("Mode")).toHaveValue("strict");
  await checkRow(page, "check › build").getByRole("button").click();
  await expect(
    page.getByRole("region", { name: "Explanation" }).getByLabel("Causes"),
  ).toContainText("RQ-10");
});

test('adding "job X fails" in Assumptions turns its dependent\'s check May not block, rooted in RQ-3', async ({
  page,
}) => {
  const input = results(page).getByLabel("Add a required check");
  await input.fill("e2e");
  await input.press("Enter");
  // e2e reads changes' output, which the example leaves unset.
  await expect(checkRow(page, "check › e2e")).toContainText("uncertain");

  const scenario = scenarioPane(page);
  await scenario
    .getByLabel("Assume this job fails")
    .selectOption("ci.yml › changes");
  await scenario.getByRole("button", { name: "Add", exact: true }).click();
  await expect(checkRow(page, "check › e2e")).toContainText("may not block");
  await checkRow(page, "check › e2e").getByRole("button").click();
  const causes = page
    .getByRole("region", { name: "Explanation" })
    .getByLabel("Causes");
  await expect(causes).toContainText("root RQ-3");
  await expect(causes).toContainText("WN-1");
});

test("the merge-queue toggle, in Repo facts and atop the tab, makes the example's checks Pending and blocks merge, root RQ-6", async ({
  page,
}) => {
  await results(page).getByLabel("Merge queue").selectOption("on");
  await expect(scenarioPane(page).getByLabel("Merge queue")).toHaveValue("on");
  await checkRow(page, "check › build")
    .getByRole("button", { name: "pending and blocks merge" })
    .click();
  await expect(
    page.getByRole("region", { name: "Explanation" }).getByLabel("Causes"),
  ).toContainText("root RQ-6");
});

test("Require every produced check adds build, test and the other job names as chips, and counts what it left out", async ({
  page,
}) => {
  const preset = results(page).getByRole("button", {
    name: "Require every produced check",
  });
  await preset.click();
  await expect(chips(page, results(page))).toHaveText([
    /^build/,
    /^test/,
    /^changes/,
    /^e2e/,
    /^deploy/,
    /^triage/,
  ]);
  await expect(page.locator("#toasts")).toHaveText(
    "Required 4 more produced checks. Left out 0 matrix jobs, 0 remote reusable callers and 0 job name: expressions.",
  );

  // A matrix job's and a remote caller's checks can't be known, so they are counted, not added.
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(".github/workflows/matrix.yml");
  await dialog
    .getByLabel("YAML")
    .fill(
      "on: pull_request\njobs:\n" +
        "  lint:\n    runs-on: x\n    steps:\n      - run: echo\n" +
        "  unit:\n    strategy:\n      matrix:\n        node: [20, 22]\n    runs-on: x\n    steps:\n      - run: echo\n" +
        "  call:\n    uses: octo/lib/.github/workflows/ci.yml@v1\n",
    );
  await dialog.getByRole("button", { name: "Add file" }).click();
  await results(page).getByRole("tab", { name: "Merge readiness" }).click();
  await preset.click();
  await expect(chips(page, results(page)).last()).toHaveText(/^lint/);
  await expect(page.locator("#toasts")).toHaveText(
    "Required 1 more produced check. Left out 1 matrix job, 1 remote reusable caller and 0 job name: expressions.",
  );
});
