import type { Page } from "@playwright/test";

/** The Scenario form's Event fieldset, apart from the Follow-up event's same-named fields. */
export const eventForm = (page: Page) =>
  page.getByRole("group", { name: "Event", exact: true });
