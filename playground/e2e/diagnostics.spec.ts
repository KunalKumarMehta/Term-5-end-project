import { expect, test, type Page } from "@playwright/test";

// A schema error on line 3: GitHub would reject this file.
const BROKEN = `on:
  push:
    branchez: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

async function paste(page: Page, text: string) {
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("YAML").fill(text);
  await dialog.getByRole("button", { name: "Add file" }).click();
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const banner = (page: Page) =>
  results(page).getByRole("list", { name: "Diagnostics" });
const editor = (page: Page) =>
  page.getByRole("textbox", { name: "YAML of .github/workflows/untitled.yml" });
const activeLine = (page: Page) => page.locator(".cm-activeLine");

declare global {
  interface Window {
    said: string[];
  }
}

test.beforeEach(async ({ page }) => {
  // Record every text the status region takes, from before load.
  await page.addInitScript(() => {
    window.said = [];
    document.addEventListener("DOMContentLoaded", () => {
      const status = document.getElementById("status")!;
      new MutationObserver(() => {
        if (status.textContent) window.said.push(status.textContent);
      }).observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
  });
  await page.goto("./");
});

test("a pasted broken file shows its Diagnostic in the gutter, the tab count and the results banner, even before the date is set", async ({
  page,
}) => {
  await expect(results(page)).toContainText("No Workflow set yet");
  await paste(page, BROKEN);

  await expect(
    page.locator(".cm-gutter-lint .cm-lint-marker-error"),
  ).toHaveCount(1);
  await expect(page.locator(".cm-lintRange-error")).toHaveText("branchez");
  await expect(
    page.getByRole("tab", { name: "untitled.yml 1 Diagnostic" }),
  ).toBeVisible();
  await expect(banner(page).getByRole("listitem")).toHaveText([
    "untitled.yml:3 Unexpected value 'branchez'",
  ]);
  await expect(results(page)).toContainText(
    "Set the simulation date to see Verdicts",
  );

  await page.getByLabel("Simulation date").fill("2026-12-03");
  await expect(results(page)).toContainText(
    "No Verdicts: every file has Diagnostics (see above).",
  );
  await expect(banner(page).getByRole("listitem")).toHaveCount(1);
});

test("a banner entry moves the editor to the Diagnostic, and F8 and Mod-Shift-M reach it from the keyboard", async ({
  page,
}) => {
  await paste(page, BROKEN);
  await banner(page)
    .getByRole("link", { name: "untitled.yml:3 Unexpected value 'branchez'" })
    .click();
  await expect(editor(page)).toBeFocused();
  await expect(activeLine(page)).toHaveText("    branchez: [main]");

  await page.keyboard.press("ControlOrMeta+End");
  await expect(activeLine(page)).not.toHaveText("    branchez: [main]");
  await page.keyboard.press("F8");
  await expect(activeLine(page)).toHaveText("    branchez: [main]");

  await page.keyboard.press("ControlOrMeta+Shift+M");
  await expect(page.locator(".cm-panel-lint")).toContainText(
    "Unexpected value 'branchez'",
  );
});

test("pasting a broken file announces its Diagnostics count, and fixing it announces they cleared", async ({
  page,
}) => {
  await paste(page, BROKEN);
  await expect(page.locator("#status")).toHaveText(
    "· untitled.yml has 1 Diagnostic",
  );

  await editor(page).getByText("branchez").dblclick();
  await page.keyboard.insertText("branches");
  await expect(page.locator("#status")).toHaveText(
    "· untitled.yml Diagnostics cleared",
  );
  await expect(banner(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.said)).toEqual([
    "· untitled.yml has 1 Diagnostic",
    "· untitled.yml Diagnostics cleared",
  ]);
});

test.describe("on a 390 px screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a banner entry switches to the YAML tab and moves the editor to the Diagnostic", async ({
    page,
  }) => {
    await paste(page, BROKEN);
    const bar = page.getByRole("navigation", { name: "Panes" });
    await bar.getByRole("button", { name: "Results" }).click();
    await banner(page).getByRole("link").click();

    await expect(bar.getByRole("button", { name: "YAML" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(editor(page)).toBeFocused();
    await expect(activeLine(page)).toHaveText("    branchez: [main]");
  });
});
