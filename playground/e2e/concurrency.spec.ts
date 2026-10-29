import { expect, test, type Page } from "@playwright/test";

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const followUp = (page: Page) =>
  page.getByRole("group", { name: "Follow-up event" });
const row = (page: Page, key: string) =>
  results(page)
    .getByRole("table")
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: key, exact: true }) });
const causes = (page: Page) =>
  page.getByRole("region", { name: "Explanation" }).getByLabel("Causes");
const CI_GROUP = "ci-${{ github.head_ref || github.ref }}";

/** Pastes over one of the example's files. */
async function paste(page: Page, text: string, name = "ci.yml") {
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(`.github/workflows/${name}`);
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
  await dialog.getByRole("button", { name: "Replace it" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await results(page).getByRole("button", { name: "Load example" }).click();
  await results(page).getByRole("tab", { name: "Concurrency" }).click();
});

test("Load example fills a Follow-up synchronize on the same PR, in its own Scenario form section", async ({
  page,
}) => {
  await expect(followUp(page).getByLabel("Event name")).toHaveValue(
    "pull_request",
  );
  await expect(followUp(page).getByLabel("Activity type")).toHaveValue(
    "synchronize",
  );
  await expect(followUp(page).getByLabel("Actor kind")).toHaveValue("fork");
  await expect(followUp(page).getByLabel("Ref")).toHaveValue("feature");
  await expect(followUp(page).getByLabel("Changed files")).toHaveValue(
    "src/app.ts",
  );
  await expect(followUp(page).getByLabel("Run A when B arrives")).toHaveValue(
    "in-progress",
  );
});

test("Load example's Concurrency tab: run A cancelled (CC-2) in group ci-feature beside its expression, then run B runs", async ({
  page,
}) => {
  // #15 §4 segment 1:30.
  const a = row(page, "ci.yml › concurrency.A");
  await expect(a).toContainText("cancelled");
  await expect(a).toContainText(`group ci-feature from ${CI_GROUP}`);
  await expect(results(page)).toContainText("while A is in progress…");
  const b = row(page, "ci.yml › concurrency.B");
  await expect(b).toContainText("runs");
  await expect(b).toContainText("group ci-feature");
  // deploy.yml's push-only run makes no item on a PR.
  await expect(row(page, "deploy.yml › concurrency.A")).toContainText("no-run");

  await a.getByRole("button", { name: "cancelled" }).click();
  await expect(causes(page)).toContainText("root CC-2");
  await expect(causes(page)).toContainText("ci.yml:13");

  // Run A pending when B arrives: queue: single replaces it (CC-1).
  await followUp(page)
    .getByLabel("Run A when B arrives")
    .selectOption("pending");
  await expect(results(page)).toContainText("while A is pending…");
  await expect(causes(page)).toContainText("root CC-1");
});

test("removing the Follow-up event leaves run A and the Add a Follow-up event line, linked to that section", async ({
  page,
}) => {
  await followUp(page)
    .getByRole("button", { name: "Remove Follow-up event" })
    .click();
  await expect(row(page, "ci.yml › concurrency.A")).toContainText("runs");
  await expect(row(page, "ci.yml › concurrency.B")).toHaveCount(0);
  const add = results(page).getByRole("link", {
    name: "Add a Follow-up event to see what happens to run B",
  });
  await add.click();
  await expect(
    followUp(page).getByRole("button", { name: "Add a Follow-up event" }),
  ).toBeFocused();
  await followUp(page)
    .getByRole("button", { name: "Add a Follow-up event" })
    .click();
  await expect(row(page, "ci.yml › concurrency.B")).toContainText("runs");
});

test("with Compare on, concurrency.B only in the Scenario with a Follow-up event is a difference: ◆, and the other cell shows —", async ({
  page,
}) => {
  await page.getByRole("banner").getByLabel("Compare").check();
  // Compare opens Scenario 2, a copy of the Fork PR.
  await followUp(page)
    .getByRole("button", { name: "Remove Follow-up event" })
    .click();
  await expect(
    row(page, "ci.yml › concurrency.B").getByRole("cell"),
  ).toHaveText(["◆ differs", /^Fork PRruns/, "Scenario 2—"]);
  await expect(
    row(page, "ci.yml › concurrency.A").getByRole("cell"),
  ).toHaveText(["◆ differs", /^Fork PRcancelled/, /^Scenario 2runs/]);
  await expect(results(page)).toContainText(
    "Scenario 2: Add a Follow-up event to see what happens to run B",
  );

  // The All Verdicts grid agrees (#12 addendum C).
  await results(page).getByRole("tab", { name: "All Verdicts" }).click();
  await expect(
    row(page, "ci.yml › concurrency.B").getByRole("cell"),
  ).toHaveText(["◆ differs", "Fork PRruns", "Scenario 2—"]);
});

test("a github.event value run B's group reads is settled on the Follow-up event", async ({
  page,
}) => {
  await paste(
    page,
    "on: pull_request\nconcurrency: pr-${{ github.event.pull_request.number }}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: make\n",
  );
  await results(page).getByRole("tab", { name: "Concurrency" }).click();
  const b = row(page, "ci.yml › concurrency.B");
  await expect(b).toContainText("uncertain (pending, runs)");
  await b.getByRole("button").click();
  const settleIt = page
    .getByRole("region", { name: "Explanation" })
    .getByRole("region", { name: "Settle it" });
  await expect(settleIt).toContainText(
    "github.event.pull_request.number: github.event.pull_request.number on the Follow-up event",
  );
  await settleIt.getByLabel("Another value").fill("7");
  await settleIt.getByRole("button", { name: "Settle" }).click();
  await expect(
    followUp(page).getByRole("list", {
      name: "Follow-up event payload values",
    }),
  ).toHaveText("github.event.pull_request.number = 7 Remove");
  await expect(
    page.getByRole("list", { name: "Event payload values", exact: true }),
  ).toHaveCount(0);
  // Run A's Event still lacks it, so B stays uncertain, now settled on the main Event.
  await expect(b).toContainText("group pr-7");
  await expect(settleIt).toContainText(
    "github.event.pull_request.number on the Event",
  );
});

test("a Workflow set with no concurrency: says no run waits for or cancels another", async ({
  page,
}) => {
  const plain =
    "on: push\njobs:\n  a:\n    runs-on: x\n    steps:\n      - run: a\n";
  await paste(page, plain, "deploy.yml");
  await paste(page, plain);
  await results(page).getByRole("tab", { name: "Concurrency" }).click();
  await expect(results(page)).toContainText(
    "No GitHub workflow or job here declares concurrency:, so no run waits for or cancels another.",
  );
  await expect(results(page)).not.toContainText("Not checked");
});

const QUEUE_MAX =
  "on: pull_request\nconcurrency:\n  group: ci\n  queue: max\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: make\n";

test("for a queue: max group, the Follow-up event's pending-run count moves run B between pending, its place likely, not certain (CC-6), and cancelled once the queue is full (CC-3)", async ({
  page,
}) => {
  await paste(page, QUEUE_MAX);
  await results(page).getByRole("tab", { name: "Concurrency" }).click();
  const count = followUp(page).getByLabel("Runs already pending");
  await expect(count).toHaveValue("0");
  const b = row(page, "ci.yml › concurrency.B");
  await expect(b).toContainText("pending");
  await expect(b).toContainText("likely #1 in the queue, not certain (CC-6)");
  await expect(row(page, "ci.yml › concurrency.A")).toContainText("runs");

  await count.fill("100");
  await expect(b).toContainText("cancelled");
  await b.getByRole("button", { name: "cancelled" }).click();
  await expect(causes(page)).toContainText("root CC-3");

  await count.fill("99");
  await expect(b).toContainText("pending");
  await expect(b).toContainText("likely #100 in the queue");
});

test("run A's jobs that keep running after it is cancelled are listed as continuing (CC-9)", async ({
  page,
}) => {
  await paste(
    page,
    "on: pull_request\nconcurrency:\n  group: ci\n  cancel-in-progress: true\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: make\n  report:\n    if: always()\n    runs-on: ubuntu-latest\n    steps:\n      - run: report\n",
  );
  await results(page).getByRole("tab", { name: "Concurrency" }).click();
  const a = row(page, "ci.yml › concurrency.A");
  await expect(a).toContainText("cancelled");
  await expect(a.getByRole("list", { name: "continuing" })).toHaveText(
    "ci.yml › report",
  );
  await expect(row(page, "ci.yml › concurrency.B")).toContainText(
    "uncertain (pending, runs)",
  );
});

test("with no concurrency: declared, the Concurrency tab says what it couldn't check: files with Diagnostics and remote reusable workflows (WN-6)", async ({
  page,
}) => {
  await paste(
    page,
    "on: push\njobs:\n  a:\n    uses: octo/lib/.github/workflows/x.yml@v1\n",
    "deploy.yml",
  );
  await paste(page, "on: push\njobs: [\n");
  await results(page).getByRole("tab", { name: "Concurrency" }).click();
  await expect(results(page)).toContainText(
    "No GitHub workflow or job here declares concurrency:, so no run waits for or cancels another. Not checked: files with Diagnostics and remote reusable workflows (WN-6).",
  );
});
