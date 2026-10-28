import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PLATFORM_BASELINE } from "../../src/core/baseline";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

test("the footer shows the version, the collapsed Platform baseline and the licences", async ({
  page,
  request,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "WhyNoRun" })).toBeVisible();

  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText(`whynorun ${version}`);

  const assumes = footer.getByText("What WhyNoRun always assumes");
  const items = footer.getByRole("listitem");
  await expect(assumes).toBeVisible();
  await expect(items.first()).toBeHidden();
  await assumes.click();
  await expect(items).toHaveText(
    PLATFORM_BASELINE.map((item) => item.replaceAll("`", "")),
  );

  const licences = footer.getByRole("link", { name: "Third-party licences" });
  const href = await licences.getAttribute("href");
  expect(href).toContain("THIRD_PARTY_LICENSES.md");
  const response = await request.get(new URL(href!, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("react");
});
