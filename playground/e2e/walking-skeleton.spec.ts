import { expect, test, type Page } from "@playwright/test";

const CI = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src https://api.github.com https://raw.githubusercontent.com; object-src 'none'; base-uri 'none'";

async function paste(page: Page, text: string, path?: string) {
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  if (path !== undefined) await dialog.getByLabel("Path").fill(path);
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

declare global {
  interface Window {
    violations: string[];
    said: string[];
  }
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });

test.beforeEach(async ({ page }) => {
  // Record every CSP violation and every text the status region takes, from before load.
  await page.addInitScript(() => {
    const w = window;
    w.violations = [];
    w.said = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      w.violations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
    document.addEventListener("DOMContentLoaded", () => {
      const status = document.getElementById("status")!;
      new MutationObserver(() => {
        if (status.textContent) w.said.push(status.textContent);
      }).observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  });
  await page.goto("./");
});

test("a pasted push workflow runs with root EV-0, and schedule is unsupported, announced once, under the CSP", async ({
  page,
}) => {
  await expect(
    page.locator('meta[http-equiv="Content-Security-Policy"]'),
  ).toHaveAttribute("content", CSP);
  await expect(results(page)).toContainText("No Workflow set yet");
  await expect(
    results(page).getByRole("button", { name: "Import repo" }),
  ).toBeDisabled();
  for (const name of ["Load example", "Paste", "Upload"])
    await expect(results(page).getByRole("button", { name })).toBeEnabled();

  await paste(page, CI, ".github/workflows/ci.yml");
  await expect(page.locator("#toasts")).toHaveText("Pasted ci.yml");

  await page.getByLabel("Event name").fill("push");
  await page.getByLabel("Simulation date").fill("2026-12-03");
  const row = results(page).getByRole("listitem");
  await expect(row).toHaveText([
    "ci.yml runs root EV-0",
    "ci.yml › build runs root WN-2",
  ]);

  await page.getByLabel("Event name").fill("schedule");
  await expect(results(page)).toContainText(
    "Unsupported Scenario: Outside v1: WhyNoRun doesn't simulate this Event. (WN-3)",
  );
  // Longer than the 300 ms debounce, so a second announcement would have landed.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.said)).toEqual([
    "Results updated: 3 Verdicts changed",
  ]);
  expect(await page.evaluate(() => window.violations)).toEqual([]);
});

test("a typed path that clashes offers Replace it", async ({ page }) => {
  await paste(page, CI, ".github/workflows/ci.yml");
  await paste(page, "on: pull_request\n", ".github/workflows/ci.yml");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    ".github/workflows/ci.yml is already in the Workflow set.",
  );
  await dialog.getByRole("button", { name: "Replace it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tab", { name: "ci.yml" })).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "YAML of .github/workflows/ci.yml" }),
  ).toHaveText("on: pull_request");
});

test("a path outside .github/workflows/ is refused inline", async ({
  page,
}) => {
  await paste(page, CI, "ci.yml");
  await expect(page.getByRole("dialog")).toContainText(
    "Use a path like .github/workflows/ci.yml",
  );
});

test("a second default-named paste becomes untitled-2.yml", async ({
  page,
}) => {
  await paste(page, CI);
  await paste(page, CI);
  await expect(page.getByRole("tablist", { name: "Files" })).toHaveText(
    "untitled.ymluntitled-2.yml",
  );
});

test("clearing the date blanks the results to the prompt, linked to the field", async ({
  page,
}) => {
  await paste(page, CI);
  await page.getByLabel("Simulation date").fill("2026-12-03");
  await expect(results(page).getByRole("listitem")).toHaveCount(2);

  await page.getByLabel("Simulation date").fill("");
  const prompt = results(page).getByRole("link", {
    name: "Set the simulation date to see Verdicts",
  });
  await expect(prompt).toBeVisible();
  await expect(results(page).getByRole("listitem")).toHaveCount(0);
  await prompt.click();
  await expect(page.getByLabel("Simulation date")).toBeFocused();
});

test("an unsupported event shows the Unsupported panel, its inputs linked to their fields", async ({
  page,
}) => {
  await paste(page, CI);
  await page.getByLabel("Event name").fill("pull_request");
  await page.getByLabel("Simulation date").fill("2026-12-03");

  const panel = results(page);
  await expect(panel).toContainText(
    "Unsupported Scenario: Outside v1: WhyNoRun doesn't simulate this Event. (WN-3)",
  );
  await expect(panel).toContainText("Actor kind = member");
  await panel.getByRole("link", { name: "Event name = pull_request" }).click();
  await expect(page.getByLabel("Event name")).toBeFocused();
});

test.describe("on a 390 px screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const scrollsSideways = (page: Page) =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

  test("the bottom bar switches panes, the header stays and the page never scrolls sideways", async ({
    page,
  }) => {
    const bar = page.getByRole("navigation", { name: "Panes" });
    await paste(page, CI.repeat(3) + `# ${"a-very-long-line-".repeat(20)}\n`);

    for (const [tab, pane] of [
      ["Scenario", "Scenario"],
      ["Results", "Results"],
      ["YAML", "YAML"],
    ]) {
      await bar.getByRole("button", { name: tab }).click();
      await expect(bar.getByRole("button", { name: tab })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByRole("region", { name: pane })).toBeVisible();
      await expect(page.getByRole("region")).toHaveCount(1);
      await expect(
        page.getByRole("banner").getByRole("button", { name: "Paste" }),
      ).toBeVisible();
      expect(await scrollsSideways(page)).toBe(false);
    }
  });

  test("switching panes keeps each pane's state", async ({ page }) => {
    const bar = page.getByRole("navigation", { name: "Panes" });
    await paste(page, CI, ".github/workflows/ci.yml");
    const editor = page.getByRole("textbox", {
      name: "YAML of .github/workflows/ci.yml",
    });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("# edited");

    await bar.getByRole("button", { name: "Scenario" }).click();
    await page.getByLabel("Simulation date").fill("2026-12-03");
    await bar.getByRole("button", { name: "Results" }).click();
    await expect(results(page).getByRole("listitem")).toHaveText([
      "ci.yml runs root EV-0",
      "ci.yml › build runs root WN-2",
    ]);

    await bar.getByRole("button", { name: "YAML" }).click();
    await expect(editor).toContainText("# edited");
    await bar.getByRole("button", { name: "Scenario" }).click();
    await expect(page.getByLabel("Simulation date")).toHaveValue("2026-12-03");
  });
});
