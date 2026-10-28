import { expect, test } from "vitest";
import { simulate } from "./index";

test("an empty Workflow set gives no Verdicts and no Diagnostics", () => {
  expect(simulate([], {})).toEqual({ verdicts: [], diagnostics: [] });
});
