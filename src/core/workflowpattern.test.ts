/*!
 * Test cases ported from nektos/act's pkg/workflowpattern (workflow_pattern_test.go at 2b8b3d6).
 *
 * MIT License
 *
 * Copyright (c) 2019
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
import { simulate } from "./index";

// [patterns, inputs, skipResult, filterResult], as in act.
const cases: [string[], string[], boolean, boolean][] = [
  [["*"], ["path/with/slash"], true, false],
  [
    ["path/a", "path/b", "path/c"],
    ["meta", "path/b", "otherfile"],
    false,
    false,
  ],
  [["path/a", "path/b", "path/c"], ["path/b"], false, true],
  [["path/a", "path/b", "path/c"], ["path/c", "path/b"], false, true],
  [["path/a", "path/b", "path/c"], ["path/c", "path/b", "path/a"], false, true],
  [
    ["path/a", "path/b", "path/c"],
    ["path/c", "path/b", "path/d", "path/a"],
    false,
    false,
  ],
  [[], [], false, false],
  [["\\!file"], ["!file"], false, true],
  [["escape\\\\backslash"], ["escape\\backslash"], false, true],
  [[".yml"], ["fyml"], true, false],
  [["feature/*"], ["feature/my-branch"], false, true],
  [["feature/*"], ["feature/your-branch"], false, true],
  [["feature/**"], ["feature/beta-a/my-branch"], false, true],
  [["feature/**"], ["feature/beta-a/my-branch"], false, true],
  [["feature/**"], ["feature/mona/the/octocat"], false, true],
  [["main", "releases/mona-the-octocat"], ["main"], false, true],
  [
    ["main", "releases/mona-the-octocat"],
    ["releases/mona-the-octocat"],
    false,
    true,
  ],
  [["*"], ["main"], false, true],
  [["*"], ["releases"], false, true],
  [["**"], ["all/the/branches"], false, true],
  [["**"], ["every/tag"], false, true],
  [["*feature"], ["mona-feature"], false, true],
  [["*feature"], ["feature"], false, true],
  [["*feature"], ["ver-10-feature"], false, true],
  [["v2*"], ["v2"], false, true],
  [["v2*"], ["v2.0"], false, true],
  [["v2*"], ["v2.9"], false, true],
  [["v[12].[0-9]+.[0-9]+"], ["v1.10.1"], false, true],
  [["v[12].[0-9]+.[0-9]+"], ["v2.0.0"], false, true],
  [["*"], ["README.md"], false, true],
  [["*"], ["server.rb"], false, true],
  [["*.jsx?"], ["page.js"], false, true],
  [["*.jsx?"], ["page.jsx"], false, true],
  [["**"], ["all/the/files.md"], false, true],
  [["*.js"], ["app.js"], false, true],
  [["*.js"], ["index.js"], false, true],
  [["**.js"], ["index.js"], false, true],
  [["**.js"], ["js/index.js"], false, true],
  [["**.js"], ["src/js/app.js"], false, true],
  [["docs/*"], ["docs/README.md"], false, true],
  [["docs/*"], ["docs/file.txt"], false, true],
  [["docs/**"], ["docs/README.md"], false, true],
  [["docs/**"], ["docs/mona/octocat.txt"], false, true],
  [["docs/**/*.md"], ["docs/README.md"], false, true],
  [["docs/**/*.md"], ["docs/mona/hello-world.md"], false, true],
  [["docs/**/*.md"], ["docs/a/markdown/file.md"], false, true],
  [["**/docs/**"], ["docs/hello.md"], false, true],
  [["**/docs/**"], ["dir/docs/my-file.txt"], false, true],
  [["**/docs/**"], ["space/docs/plan/space.doc"], false, true],
  [["**/README.md"], ["README.md"], false, true],
  [["**/README.md"], ["js/README.md"], false, true],
  [["**/*src/**"], ["a/src/app.js"], false, true],
  [["**/*src/**"], ["my-src/code/js/app.js"], false, true],
  [["**/*-post.md"], ["my-post.md"], false, true],
  [["**/*-post.md"], ["path/their-post.md"], false, true],
  [["**/migrate-*.sql"], ["migrate-10909.sql"], false, true],
  [["**/migrate-*.sql"], ["db/migrate-v1.0.sql"], false, true],
  [["**/migrate-*.sql"], ["db/sept/migrate-v1.sql"], false, true],
  [["*.md", "!README.md"], ["hello.md"], false, true],
  [["*.md", "!README.md"], ["README.md"], true, true],
  [["*.md", "!README.md"], ["docs/hello.md"], true, true],
  [["*.md", "!README.md", "README*"], ["hello.md"], false, true],
  [["*.md", "!README.md", "README*"], ["README.md"], false, true],
  [["*.md", "!README.md", "README*"], ["README.doc"], false, true],
];

const jobs = "jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: echo\n";

// One ref per case: the cases with a list of changed files run with path filters (#59).
const oneRef = cases.filter(([, inputs]) => inputs.length === 1);

test.each(
  oneRef.flatMap(([patterns, [ref], skipped, ignored]) => [
    ["branches", patterns, ref!, skipped] as const,
    ["branches-ignore", patterns, ref!, ignored] as const,
  ]),
)("%s: %j on a push to %j is skipped: %s", (filter, patterns, ref, skipped) => {
  const text = `on:\n  push:\n    ${filter}: ${JSON.stringify(patterns)}\n${jobs}`;
  const { verdicts, diagnostics } = simulate(
    [{ path: ".github/workflows/ci.yml", text }],
    { event: { name: "push", ref }, repo: { date: "2026-12-03" } },
  );
  expect(diagnostics).toEqual([]);
  expect(
    verdicts.filter((v) => v.key === "ci.yml").map((v) => v.value),
  ).toEqual([skipped ? "skipped" : "runs"]);
});
