import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

test("the playground loads and its footer shows the version and the licences", async ({
  page,
  request,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "WhyNoRun" })).toBeVisible();

  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText(`whynorun ${version}`);

  const licences = footer.getByRole("link", { name: "Third-party licences" });
  const href = await licences.getAttribute("href");
  const response = await request.get(new URL(href!, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("react");
});
