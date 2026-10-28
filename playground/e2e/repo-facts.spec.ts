import { expect, test, type Page } from "@playwright/test";

// No permissions: anywhere, so the token default decides every token scope (PERM-1).
const CI = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

const results = (page: Page) => page.getByRole("region", { name: "Results" });
const explanation = (page: Page) =>
  page.getByRole("region", { name: "Explanation" });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.getByRole("banner").getByRole("button", { name: "Paste" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste a GitHub workflow" });
  await dialog.getByLabel("Path").fill(".github/workflows/ci.yml");
  await dialog.getByLabel("YAML").fill(CI);
  await dialog.getByRole("button", { name: "Add file" }).click();
  await page.getByLabel("Simulation date").fill("2026-12-03");
});

test("unset Repo facts show their defaults as assumed, in italic with a dotted underline; changing one makes it set", async ({
  page,
}) => {
  const facts = [
    ["Visibility", "public"],
    ["Created before 2026-09-17", "yes"],
    ["Token default", "restricted"],
    ["Event policy", "none"],
  ] as const;
  for (const [label, value] of facts) {
    const field = page.getByLabel(label);
    await expect(field.locator("option:checked")).toHaveText(value);
    await expect(field).toHaveAccessibleDescription("assumed");
  }
  const branch = page.getByLabel("Default branch");
  await expect(branch).toHaveAttribute("placeholder", "main");
  await expect(branch).toHaveAccessibleDescription("assumed");

  const token = page.getByLabel("Token default");
  const tag = page.locator("#repo-token-default-source");
  await expect(tag).toHaveText("assumed");
  await expect(tag).toHaveCSS("font-style", "italic");
  await expect(tag).toHaveCSS("text-decoration-style", "dotted");
  await expect(token).toHaveCSS("border-bottom-style", "dotted");

  await token.selectOption("permissive");
  await expect(token).toHaveAccessibleDescription("set");
  await expect(tag).toHaveCSS("font-style", "normal");
  await expect(token).not.toHaveCSS("border-bottom-style", "dotted");
  // The others stay assumed.
  await expect(page.getByLabel("Visibility")).toHaveAccessibleDescription(
    "assumed",
  );

  await branch.fill("trunk");
  await expect(branch).toHaveAccessibleDescription("set");
});

test("an assumed default that decides a Verdict is a grey WN-5 cause after the root, and its set it link focuses the Repo facts field", async ({
  page,
}) => {
  await results(page)
    .getByRole("button", { name: /^ci\.yml › build › token\.contents read/ })
    .click();
  const causes = explanation(page)
    .getByRole("list", { name: "Causes" })
    .locator("> li");
  await expect(causes).toHaveCount(2);
  await expect(causes.first()).toContainText("root PERM-1");
  // The Scenario input the root used shows its source tag.
  await expect(
    causes.first().getByRole("link", { name: "Token default = restricted" }),
  ).toBeVisible();
  await expect(causes.first()).toContainText(
    "Token default = restricted assumed",
  );
  const wn5 = causes.nth(1);
  await expect(wn5).toContainText(
    "WN-5: Token default = restricted (assumed default)",
  );
  await expect(wn5).toHaveCSS("color", "rgb(89, 99, 110)");

  await wn5.getByRole("link", { name: "set it" }).click();
  const token = page.getByLabel("Token default");
  await expect(token).toBeFocused();

  // Set, the token default still roots the Verdict, but nothing is assumed.
  await token.selectOption("permissive");
  await expect(explanation(page).getByRole("heading")).toHaveText(
    "ci.yml › build › token.contents write",
  );
  await expect(causes).toHaveCount(1);
  await expect(causes.first()).toContainText("Token default = permissive set");
});
