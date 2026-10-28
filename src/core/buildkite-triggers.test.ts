/*!
 * Trigger cases selected from buildkite/buildkite-gha internal/buildkite/triggers_test.go (at 9f42952).
 *
 * MIT License
 *
 * Copyright (c) 2026 Buildkite Pty Ltd
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { expect, test } from "vitest";
import { simulate, type Event } from "./index";

const jobs = "jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n";

// [the test it comes from, on:, Event, value]
test.each<[string, string, Event, string]>([
  [
    "push branch mismatch",
    "push:\n    branches: [main, development]",
    { name: "push", ref: "feature" },
    "skipped",
  ],
  [
    "push branch exclusion mismatch",
    "push:\n    branches-ignore: [feature]",
    { name: "push", ref: "feature" },
    "skipped",
  ],
  [
    "ordered push branch match",
    "push:\n    branches: ['release/**', '!release/**-alpha', release/special-alpha]",
    { name: "push", ref: "release/special-alpha" },
    "runs",
  ],
  [
    "push separates branch and tag filters: branch",
    "push:\n    branches: ['release/**', '!release/**-alpha', release/special-alpha]\n    tags: ['v[0-9]+', '!v0']",
    { name: "push", ref: "refs/heads/release/1-alpha" },
    "skipped",
  ],
  [
    "push separates branch and tag filters: tag",
    "push:\n    branches: ['release/**', '!release/**-alpha', release/special-alpha]\n    tags: ['v[0-9]+', '!v0']",
    { name: "push", ref: "refs/tags/v10" },
    "runs",
  ],
  [
    "push separates branch and tag filters: excluded tag",
    "push:\n    branches: ['release/**']\n    tags: ['v[0-9]+', '!v0']",
    { name: "push", ref: "refs/tags/v0" },
    "skipped",
  ],
  [
    "push tag mismatch",
    "push:\n    tags-ignore: [v0]",
    { name: "push", ref: "refs/tags/v0" },
    "skipped",
  ],
  [
    "branch push with only tag filters",
    "push:\n    tags: ['v*']",
    { name: "push", ref: "main" },
    "skipped",
  ],
  [
    "tag push with only branch filters",
    "push:\n    branches: [main]",
    { name: "push", ref: "refs/tags/v1" },
    "skipped",
  ],
  [
    "pull request base mismatch",
    "pull_request:\n    branches: [main]",
    { name: "pull_request", base: "development", type: "opened" },
    "skipped",
  ],
  [
    "pull request base, not push branch",
    "push:\n    branches: [main]\n  pull_request:\n    branches: [main]",
    {
      name: "pull_request",
      ref: "chore_updates",
      base: "main",
      type: "opened",
    },
    "runs",
  ],
  [
    "push branch, not pull request base",
    "push:\n    branches: [main]\n  pull_request:\n    branches: [main]",
    { name: "push", ref: "chore_updates" },
    "skipped",
  ],
  [
    "pull request activity mismatch",
    "pull_request:",
    { name: "pull_request", type: "closed" },
    "skipped",
  ],
  [
    "null types use default activities: opened",
    "pull_request:",
    { name: "pull_request", type: "opened" },
    "runs",
  ],
  [
    "null types use default activities: synchronize",
    "pull_request:",
    { name: "pull_request", type: "synchronize" },
    "runs",
  ],
  [
    "null types use default activities: reopened",
    "pull_request:",
    { name: "pull_request", type: "reopened" },
    "runs",
  ],
  [
    "null types use default activities: edited",
    "pull_request:",
    { name: "pull_request", type: "edited" },
    "skipped",
  ],
  [
    "empty types use default activities: opened",
    "pull_request:\n    types: []",
    { name: "pull_request", type: "opened" },
    "runs",
  ],
  [
    "empty types use default activities: closed",
    "pull_request:\n    types: []",
    { name: "pull_request", type: "closed" },
    "skipped",
  ],
  [
    "explicit types gain no default action",
    "pull_request:\n    branches-ignore: ['docs/**']\n    types: [labeled, ready_for_review]",
    { name: "pull_request", type: "opened" },
    "skipped",
  ],
  [
    "explicit types: labeled",
    "pull_request:\n    branches-ignore: ['docs/**']\n    types: [labeled, ready_for_review]",
    { name: "pull_request", type: "labeled", base: "main" },
    "runs",
  ],
  [
    "base branch against branches-ignore",
    "pull_request:\n    branches-ignore: ['docs/**']\n    types: [labeled, ready_for_review]",
    { name: "pull_request", type: "labeled", base: "docs/api" },
    "skipped",
  ],
  [
    "escaped special character keeps its modifier",
    "push:\n    branches: ['release/\\*?/v[0-9]+']",
    { name: "push", ref: "release/*/v12" },
    "runs",
  ],
  [
    "escaped special character keeps its modifier: absent",
    "push:\n    branches: ['release/\\*?/v[0-9]+']",
    { name: "push", ref: "release//v1" },
    "runs",
  ],
  [
    "escaped special character is literal",
    "push:\n    branches: ['release/\\*?/v[0-9]+']",
    { name: "push", ref: "release/x/v1" },
    "skipped",
  ],
  [
    "* stops at a slash",
    "push:\n    branches: ['release/*']",
    { name: "push", ref: "release/a/b" },
    "skipped",
  ],
])("%s", (_, on, event, value) => {
  const text = `on:\n  ${on}\n${jobs}`;
  const { verdicts, diagnostics } = simulate(
    [{ path: ".github/workflows/ci.yml", text }],
    { event, repo: { date: "2026-12-03" } },
  );
  expect(diagnostics).toEqual([]);
  expect(verdicts.map((v) => v.value)).toEqual([value]);
});
