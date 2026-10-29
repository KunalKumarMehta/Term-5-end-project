import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { PLATFORM_BASELINE, SHOW_DEFAULTS } from "./index";
import { SCHEMA_LINE } from "./testfile";

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

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

test("from 1.0.0 the README has no status line and marks nothing planned", () => {
  expect(readme).not.toContain("**Status:**");
  expect(readme).not.toMatch(/planned/i);
});

test("the README's Action example pins the Action to package.json's version", () => {
  expect(readme).toContain(`uses: KunalKumarMehta/whynorun@v${version}\n`);
});

test("the README shows the editor line the playground writes", () => {
  expect(readme).toContain(`${SCHEMA_LINE}\n`);
});

test("the README's Platform baseline matches the core's export", () => {
  expect(section("baseline")).toEqual(PLATFORM_BASELINE);
});

test("the README's show defaults match the core's export", () => {
  expect(section("show-defaults")).toEqual(SHOW_DEFAULTS);
});

test("the README uses the guidelines' §13 headings in their order, uninterrupted, then WhyNoRun's own sections", () => {
  const required = [
    "Problem Statement",
    "Target Users",
    "Solution",
    "Key Features",
    "Tech Stack",
    "Architecture",
    "Local Setup",
    "Environment Variables",
    "Deployment",
  ];
  expect(readme.startsWith("# WhyNoRun\n")).toBe(true);
  const headings = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  expect(headings.slice(0, required.length)).toEqual(required);
});

test("every relative link and image in the README points at a file in the repo", () => {
  const targets = [...readme.matchAll(/\]\(([^)#\s]+)[^)]*\)/g)]
    .map((m) => m[1]!)
    .filter((href) => !/^[a-z]+:/.test(href));
  expect(targets).toContain("docs/images/access-report.png");
  expect(targets).toContain("docs/images/merge-readiness.png");
  expect(targets).toContain("docs/images/concurrency.png");
  for (const href of targets) {
    expect(existsSync(new URL(`../../${href}`, import.meta.url)), href).toBe(
      true,
    );
  }
});
