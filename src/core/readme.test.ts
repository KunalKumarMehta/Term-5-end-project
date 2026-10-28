import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { PLATFORM_BASELINE, SHOW_DEFAULTS } from "./index";

const readme = readFileSync(
  new URL("../../README.md", import.meta.url),
  "utf8",
);

// The list items between `<!-- name -->` and `<!-- /name -->`.
function section(name: string): string[] {
  const match = readme.match(
    new RegExp(`<!-- ${name} -->\\n([\\s\\S]*?)<!-- /${name} -->`),
  );
  expect(match, `README markers for ${name}`).not.toBeNull();
  return match![1]!
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

test("the README's Platform baseline matches the core's export", () => {
  expect(section("baseline")).toEqual(PLATFORM_BASELINE);
});

test("the README's show defaults match the core's export", () => {
  expect(section("show-defaults")).toEqual(SHOW_DEFAULTS);
});
