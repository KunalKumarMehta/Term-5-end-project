import { main } from "../cli/main";

/**
 * The Action (#13 §4): its `tests` input, one glob pattern per line, run as
 * `whynorun test` from the cwd, which the runner sets to `GITHUB_WORKSPACE`.
 */
export function run(tests = ""): number {
  const patterns = tests
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  // After --, a pattern is never read as a flag.
  return main(["test", "--", ...patterns]);
}
