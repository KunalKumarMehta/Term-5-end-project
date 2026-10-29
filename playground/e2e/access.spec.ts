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

// The example's Fork PR Scenario, made a member's pull_request touching src.
test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await page
    .getByRole("group", { name: "Event", exact: true })
    .getByLabel("Actor kind")
    .selectOption("member");
  await results(page).getByRole("tab", { name: "Access" }).click();
});

test("clicking a cause's file:line highlights pull-requests: write in ci.yml", async ({
  page,
}) => {
  await row(page, "ci.yml › test", "pull-requests")
    .getByRole("button", { name: "write" })
    .click();
  const panel = page.getByRole("region", { name: "Explanation" });
  await expect(panel.getByRole("heading")).toHaveText(
    "ci.yml › test › token.pull-requests write",
  );
  await panel.getByRole("link", { name: "ci.yml:44" }).click();

  await expect(page.getByRole("tab", { name: "ci.yml" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".cm-line.highlighted")).toHaveText([
    "pull-requests: write",
  ]);
});

test("the ci.yml › test card shows the job's run Verdict in its header and collapses its none scopes", async ({
  page,
}) => {
  const test = card(page, "ci.yml › test");
  await expect(test.getByRole("heading")).toHaveText(
    "ci.yml › test runs Access computed as if the job runs",
  );
  const subjects = test.getByRole("rowheader");
  await expect(subjects).toHaveText(["contents", "pull-requests", "secrets"]);
  await expect(test).toContainText("15 other scopes: none");

  await test.getByRole("button", { name: "show" }).click();
  await expect(subjects).toHaveCount(18);
  await expect(row(page, "ci.yml › test", "id-token")).toContainText("none");

  // The run Verdict opens its own Explanation.
  await test.getByRole("heading").getByRole("button", { name: "runs" }).click();
  await expect(
    page.getByRole("region", { name: "Explanation" }).getByRole("heading"),
  ).toHaveText("ci.yml › test runs");
});

test("every job with steps has a card, and an Uncertain job's card shows its possible outcomes with its access", async ({
  page,
}) => {
  await expect(results(page).getByRole("region")).toHaveText([
    /^ci\.yml › build/,
    /^ci\.yml › changes/,
    /^ci\.yml › e2e uncertain \(runs, skipped\)/,
    /^ci\.yml › test/,
    /^deploy\.yml › deploy no-run/,
    /^triage\.yml › triage no-run/,
  ]);
  await expect(row(page, "deploy.yml › deploy", "contents")).toContainText(
    "write",
  );
});

test("with Compare on, each card shows both Scenarios side by side", async ({
  page,
}) => {
  await page.getByRole("banner").getByLabel("Compare").check();
  await page
    .getByRole("group", { name: "Event", exact: true })
    .getByLabel("Event name")
    .fill("push");
  await page
    .getByRole("group", { name: "Event", exact: true })
    .getByLabel("Ref")
    .fill("main");

  const deploy = card(page, "deploy.yml › deploy");
  await expect(deploy.getByRole("heading")).toHaveText(
    "deploy.yml › deploy Fork PR no-run Scenario 2 runs Access computed as if the job runs",
  );
  await expect(deploy.getByRole("columnheader")).toHaveText([
    "",
    "Subject",
    "Fork PR",
    "Scenario 2",
  ]);
  // Access is computed as if the job runs, so the push changes no row.
  const contents = row(page, "deploy.yml › deploy", "contents");
  await expect(contents.getByRole("button")).toHaveText(["write", "write"]);
  await expect(contents).not.toHaveClass("differs");
});

/** Pastes each file into a fresh page, in place of the example, on a dated push. */
async function paste(page: Page, files: Record<string, string>) {
  await page.goto("./");
  for (const [path, yaml] of Object.entries(files)) {
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Paste" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Paste a GitHub workflow",
    });
    await dialog.getByLabel("Path").fill(path);
    await dialog.getByLabel("YAML").fill(yaml);
    await dialog.getByRole("button", { name: "Add file" }).click();
  }
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await results(page).getByRole("tab", { name: "Access" }).click();
}

test("with no job that runs steps, the Access tab says why it's empty and what would fill it", async ({
  page,
}) => {
  // The callee's only job calls a remote workflow, which a callee's caller doesn't expand.
  await paste(page, {
    ".github/workflows/ci.yml":
      "on: push\njobs:\n  call:\n    uses: ./.github/workflows/lib.yml\n",
    ".github/workflows/lib.yml":
      "on: workflow_call\njobs:\n  inner:\n    uses: octo/lib/.github/workflows/x.yml@v1\n",
  });
  await expect(results(page)).toContainText(
    "No job here runs steps, so none gets a token or secrets. A job with steps: would get a card here.",
  );
});

test("a local caller has no card of its own, its callee's jobs get theirs under it, and a remote caller gets a card", async ({
  page,
}) => {
  await paste(page, {
    ".github/workflows/ci.yml":
      "on: push\njobs:\n  deploy:\n    permissions:\n      contents: read\n    uses: ./.github/workflows/lib.yml\n  remote:\n    uses: octo/lib/.github/workflows/x.yml@v1\n",
    ".github/workflows/lib.yml":
      "on: workflow_call\npermissions:\n  contents: write\njobs:\n  publish:\n    runs-on: x\n    steps:\n      - run: echo\n",
  });
  await expect(results(page).getByRole("region")).toHaveText([
    /^ci\.yml › deploy\/publish runs/,
    /^ci\.yml › remote runs/,
  ]);
  // The caller's permissions: cap the callee's write (PERM-7).
  await expect(row(page, "ci.yml › deploy/publish", "contents")).toContainText(
    "read",
  );
  await expect(row(page, "ci.yml › deploy/publish", "secrets")).toContainText(
    "empty",
  );
  // The remote callee is never fetched: its scopes are Uncertain at or below the caller's cap.
  await expect(row(page, "ci.yml › remote", "secrets")).toContainText("empty");
  await expect(row(page, "ci.yml › remote", "contents")).toContainText(
    "uncertain",
  );
});
