import type { Page } from "@playwright/test";

/** The Scenario form's Event fieldset, apart from the Follow-up event's same-named fields. */
export const eventForm = (page: Page) =>
  page.getByRole("group", { name: "Event", exact: true });

/** A fresh page in the same browser: the draft the last page saved (#87) is cleared first. */
export async function fresh(page: Page) {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}
