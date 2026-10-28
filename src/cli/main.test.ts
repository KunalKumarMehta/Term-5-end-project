import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { main } from "./main";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

afterEach(() => {
  vi.restoreAllMocks();
});

test("--version prints whynorun <version> and exits 0", () => {
  const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  expect(main(["--version"])).toBe(0);
  expect(stdout.mock.calls.map((c) => c[0]).join("")).toBe(
    `whynorun ${version}\n`,
  );
});

test("anything else is misuse: exits 2 with usage on stderr", () => {
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  expect(main(["test"])).toBe(2);
  expect(stderr.mock.calls.map((c) => c[0]).join("")).toBe(
    "usage: whynorun --version\n",
  );
});
