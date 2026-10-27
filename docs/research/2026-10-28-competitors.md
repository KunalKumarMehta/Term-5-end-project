# What existing workflow tools already do

Research for wayfinder ticket #4 (parent map #1). Written 2026-10-28.

**Question:** What do existing tools already do in this space, so that the WhyNoRun spec claims something original (guidelines §16) and credits anything it builds on?

**Method:** I read each tool's own repository at its default branch as of 2026-10-28: the README, the docs and the source files that implement trigger matching. Licences come from the GitHub API (`license.spdx_id`) and the LICENSE file. I searched GitHub Community Discussions (GraphQL search and web search), Hacker News "Show HN" posts since 2025-01-01 (Algolia API), GitHub repositories and npm for "dry run" and "workflow simulator" tools.

**Confidence key:** **High** means I read it in the primary source. **Medium** means I inferred it from source code without running it. **Unverified** means I looked and found nothing, which is weak evidence.

---

## 1. Comparison table

"Explains why" means the tool tells the user why a workflow **run**s or is **skip**ped by a trigger filter, why a run is **cancel**led by a concurrency group, and which **permission**s and **secret**s the run gets for the event.

| Tool | What it simulates or validates | Explains why (run / skip / cancel / permission / secret) | In a browser? | Behaviour tests? | Licence | Reusable logic |
|---|---|---|---|---|---|---|
| **wrkflw** (bahdotsh/wrkflw, v0.8.0) | Runs workflows locally (Docker, Podman or host emulation) and validates them. Its `wrkflw-trigger-filter` crate decides whether `on:` fires for an event and a set of changed files | **Run/skip: yes**, as a free-text `reason` string with no YAML line. **Cancel: no** (concurrency is "parsed but not enforced"). **Permission/secret: no** ("GitHub encrypted secrets and fine-grained permissions" are not yet supported) | No (Rust CLI and TUI, no Wasm target) | No | MIT, © 2025 Gokul | Its test cases and edge-case notes. The matching itself diverges from GitHub (§2.1) |
| **act** (nektos/act) | Runs workflows locally in Docker. `-n` turns off containers and "validates only workflow correctness" | **Run/skip:** only by event name; the planner ignores `branches`, `tags`, `paths` and `types`. Logs skips from job `if:`. **Cancel: no** (`concurrency` is ignored). **Permission: no** (`job.permissions` is ignored). **Secret:** only what the user passes with `-s` | No | No | MIT | `pkg/workflowpattern`: a GitHub-semantics filter matcher with a trace writer and 64 test cases. Act itself never calls it |
| **actionlint** (rhysd/actionlint) | Static checks: syntax, expression types, glob syntax, permission scope names, reusable workflow inputs and secrets, shellcheck, script injection | **No.** It validates the syntax of filters and permissions but never evaluates them against an event | **Yes**: a Wasm playground at rhysd.github.io/actionlint | No | MIT, © 2021 rhysd | Model for line and column diagnostics and for glob syntax errors. Go, so it would need porting |
| **GitHub Actions for VS Code** (github/vscode-github-actions) | Authoring help (highlighting, completion, hover, validation) and run management through the API | **No** | No (it does not support github.dev or vscode.dev) | No | MIT | Use it as a reference only. Its language features come from the `actions/languageservices` packages |
| **actions/languageservices** (`@actions/workflow-parser`, `@actions/expressions`, `@actions/languageservice`, 0.3.61) | Parses and validates against GitHub's own workflow schema. Parses and evaluates `${{ }}` expressions. Ships a browser playground | **No.** `convertOn` turns `branches`, `tags`, `paths` and `types` into data, but nothing matches them against an event. The converted `WorkflowTemplate` has no `permissions` field | **Yes** (pure TypeScript ESM; the repo has a `browser-playground`) | No | MIT, © GitHub | **Direct dependency** (already WhyNoRun's planned base): the parser with token ranges for line pointers, the expression evaluator for `if:` and `concurrency.group` |
| **Gitea** workflow detector (`modules/actions/workflows.go`) | Server-side. For each push or PR event it decides which workflows match, using branch, tag, path and type filters | **Run/skip: yes, internally**: `detectMatched`, `detectNotApplicable` and `detectFilteredOut`. Filtered-out workflows post a *skipped* commit status when the check is required. It does not report a per-pattern reason to the user | No (Go server) | Internal Go tests only | MIT, © The Gitea Authors | The matching structure (each push or PR filter axis, and the "branch or tag, either may match" rule). The 2026 `workflowpattern` rewrite is MIT |
| **Forgejo** (`modules/actions/workflows.go`, Codeberg) | The same detector, forked from Gitea. It calls the Forgejo runner's copy of act's `workflowpattern` with an `EmptyTraceWriter` | No user-facing reason (the trace is thrown away) | No | Internal tests only | Project is **GPL-3.0**. This file keeps a Gitea MIT SPDX header | Prefer the MIT upstreams (act, Gitea) to stay clear of GPL |
| **zizmor** (zizmorcore/zizmor) | Static security audits: `dangerous-triggers` (`pull_request_target`, `workflow_run`), `excessive-permissions`, `secrets-inherit`, `concurrency-limits` and others | Flags risky *configuration*. It does not simulate an event or say which run gets which token or secret | No | No | MIT | Use its audit list for ideas about which hazards to explain. No code reuse planned |
| **2025–26 local runners**: localci, Preloop, ci-debugger, actrun (archived) | Run jobs locally or in microVMs, some with breakpoints | Execution only. None documents trigger-filter or permission explanation | No | No | MIT / MIT / MIT / Apache-2.0 | None |
| **GitHub itself** | Evaluates triggers server-side | The UI shows no reason. A skipped required check stays "Pending" | n/a | n/a | n/a | n/a |

---

## 2. Evidence per tool

### 2.1 wrkflw and its trigger filter

- The README advertises "**Diff-aware filtering**: skip workflows whose `on:` block doesn't match the simulated event and changed file set" and a watch mode with trigger-aware filtering. Source: https://github.com/bahdotsh/wrkflw/blob/main/README.md "Features" (lines 17–18). **High.**
- Its "Not yet supported" list includes "GitHub encrypted secrets and fine-grained permissions" and "`concurrency:` groups and `cancel-in-progress`: parsed but not enforced". Source: same README, "Not yet supported" (lines 31–36). **High.**
- Strict mode rejects `--event` without `--diff` or `--changed-files`, and simulating a `pull_request` needs `--base-branch`. Source: README "Trigger-aware execution". **High.**
- The crate README says it "returns a structured reason on skip so the CLI/TUI can explain *why* a workflow was filtered out". Source: https://github.com/bahdotsh/wrkflw/blob/main/crates/trigger-filter/README.md. In the code that reason is `TriggerMatchResult { matches: bool, matched_event: Option<String>, reason: String }`, a free-text string such as `branch 'x' did not match [...]` or `activity 'y' not in [...]`. It carries no YAML line or column. Source: `crates/trigger-filter/src/model.rs` lines 303–309 and `src/eval.rs` lines 85–100 and 186–277. **High.**
- **Divergence 1, ordered negation.** `extract_glob_list` sends every `!`-prefixed entry in `paths:` into a separate exclude list (`src/parser.rs` lines 369–402), and `matches_paths` removes excluded files first and then tests the includes (`src/path_matcher.rs` lines 9–43). GitHub documents that "the order that you define `paths` patterns matters … a matching positive pattern after a negative match will include the path again" (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax, "on.push.paths", "Including and excluding paths"). So `['sub/**', '!sub/docs/**', 'sub/docs/api/**']` would include `sub/docs/api/x` on GitHub, but wrkflw would exclude it. **Medium** (read from the code, not run).
- **Divergence 2, glob dialect.** wrkflw compiles patterns with Rust's `glob` crate (`src/model.rs` lines 172–193), where "`?` matches any single character" (https://docs.rs/glob/latest/glob/struct.Pattern.html). GitHub's cheat sheet defines `?` as "zero or one of the preceding character" and `+` as "one or more of the preceding character" (workflow-syntax, "Filter pattern cheat sheet"). **Medium.**
- No browser or Wasm build: the repository tree has no `wasm`, `web` or `playground` paths (checked with `git/trees/main?recursive=1`). **High** for the tree as of today.
- Licence: MIT, "Copyright (c) 2025 Gokul" (https://github.com/bahdotsh/wrkflw/blob/main/LICENSE). Latest release v0.8.0, 2026-04-21. **High.**

### 2.2 nektos/act

- `PlanEvent` keeps any workflow whose `on:` lists the event name. It never looks at `branches`, `paths` or `types`. Source: https://github.com/nektos/act/blob/master/pkg/model/planner.go lines 200–229. **High.**
- Issue #454, "act not honoring on.push.paths", is still **open**: https://github.com/nektos/act/issues/454. **High.**
- The `-n/--dryrun` flag "disable[s] container creation, validates only workflow correctness" (`cmd/root.go` line 107). `-l` lists workflows for an event, `-e` takes an event JSON file and `-s` passes secrets (lines 71, 78 and 88). **High.**
- The docs' "Not supported" page lists "`concurrency` is ignored", "`job.permissions` ignored", "Run steps cancellation not implemented", "`job.environment` ignored and scoping secrets by deployment environment is not supported". Source: https://nektosact.com/not_supported.html. **High.**
- The only skip explanations are a job `if:` being false and an unsupported platform (`pkg/runner/run_context.go` lines 793–820). **High.**
- `pkg/workflowpattern` (added in PR #1618, 2023-02-23) implements GitHub's filter-pattern-to-regex conversion with ordered `!` handling: in `Skip`, the last pattern that matches wins. A `TraceWriter` logs "`<file> included by pattern <p>`", "excluded by" and "ignored by". It has 64 table-driven cases in `workflow_pattern_test.go`. The PR says it is meant "to detect if we should skip the workflow". Act never wired it in; the Forgejo runner and Gitea use it. Sources: https://github.com/nektos/act/blob/master/pkg/workflowpattern/workflow_pattern.go lines 15–196, https://github.com/nektos/act/pull/1618. **High.**
- Licence: MIT ("Copyright (c) 2019"; https://github.com/nektos/act/blob/master/LICENSE). **High.**

### 2.3 actionlint

- It is "a static checker for GitHub Actions workflow files" with a "Try it online!" playground built with "HTML/CSS/TypeScript/Wasm". Sources: https://github.com/rhysd/actionlint/blob/main/README.md and `playground/README.md`. **High.**
- It checks glob *syntax* in `branches`, `tags` and `paths` (for example `^foo-`, `v[9-1]`, `./foo`), and permission *scope names and values*. It does not match them against an event. Source: `docs/checks.md` "Glob filter pattern syntax validation" (line 1504 onwards) and "Permissions" (line 2106 onwards). Reading the whole check list (`docs/checks.md` headings) shows no event simulation. **High.**
- Licence: MIT, "Copyright (c) 2021 rhysd" (`LICENSE.txt`). **High.**

### 2.4 GitHub Actions VS Code extension and language services

- The extension offers syntax highlighting, integrated documentation, "validation and code completion" for schema, expressions, event payloads and outputs, and run and log management. It does not support github.dev or vscode.dev. Source: https://github.com/github/vscode-github-actions/blob/main/README.md. **High.**
- `actions/languageservices` contains `expressions`, `workflow-parser`, `languageservice`, `languageserver` and `browser-playground`. GitHub is "not taking contributions" but still ships security fixes. Source: https://github.com/actions/languageservices/blob/main/README.md. **High.**
- `@actions/workflow-parser` and `@actions/expressions` are at 0.3.61 on npm, last modified 2026-08-04, MIT (`npm view`). The workflow-parser README calls itself "one of multiple implementations" and says `./testdata` "contains test cases that all implementations should pass". **High.**
- `convertOn` reads `branches`, `tags`, `paths` and `types` into `EventsConfig` (`workflow-parser/src/model/converter/events.ts` lines 77–80). Code search in the repo finds no glob matcher (no `minimatch`, no matching function). **Medium**: absence found by search.
- `WorkflowTemplate` and `Job` hold `events`, `jobs`, `concurrency`, `env`, `if`, `needs`, `strategy`, `environment` and `secret-*` for reusable jobs, but **no `permissions`** (`workflow-parser/src/model/workflow-template.ts` lines 10–72). WhyNoRun will need to read `permissions` from the raw template tokens. **High** for the type definition.
- The same file defines `ConcurrencySetting { group, cancelInProgress, queue?: "single" | "max" }` (lines 21–27), which points to a concurrency `queue` option. I did not find it in the public docs. **Unverified**; check it under the concurrency ticket.
- The runner (`actions/runner`) contains the workflow schema JSON but no filter-matching code, so the matching that decides triggers runs in GitHub's closed service. Source: code search of `actions/runner` for `paths-ignore` and `branches-ignore` found only `src/Sdk/WorkflowParser/workflow-v1.0.json` and a build workflow. **Medium.**

### 2.5 Gitea and Forgejo workflow detectors

- Gitea's `DetectWorkflows` returns `workflows`, `schedules`, `filtered` and `invalid`. `detectFilteredOut` means the workflow "matched but [was] excluded by a branch/paths filter; posts a skipped commit status when the context is a required check". So Gitea fixes the stuck-"Pending" problem on the server, and GitHub does not. Source: https://github.com/go-gitea/gitea/blob/main/modules/actions/workflows.go lines 36–42 and 180–240. **High.**
- `matchPushEvent` requires every filter key to match, except that when both branch and tag filters exist only one needs to match. Paths are skipped for tag pushes. Source: same file, lines 390–497. **High.**
- Gitea replaced act's matcher with its own `modules/actions/workflowpattern` ("Copyright 2026 The Gitea Authors", MIT, 65 lines, glob-based, no trace writer). Source: https://github.com/go-gitea/gitea/blob/main/modules/actions/workflowpattern/workflow_pattern.go. **High.**
- Recent changes include resolving `pull_request_target` reusable workflows at the base commit (8161479f, 2026-08-12) and YAML anchors (ed4d7ea0, 2026-08-20), from the commit history of that file. These are useful hints for edge cases. **High.**
- Forgejo's copy imports `code.forgejo.org/forgejo/runner/v13/act/workflowpattern` and passes `&workflowpattern.EmptyTraceWriter{}`. Source: https://codeberg.org/forgejo/forgejo/src/branch/forgejo/modules/actions/workflows.go lines 21 and 318–391. The Forgejo repository LICENSE is GPL-3.0 (https://codeberg.org/forgejo/forgejo/src/branch/forgejo/LICENSE), although this file keeps Gitea's MIT SPDX header. **High.**

### 2.6 Other tools and 2025–2026 "dry run" searches

- **zizmor**, MIT, 6.8k stars: audits include `dangerous-triggers` (`pull_request_target`, `workflow_run`), `excessive-permissions`, `secrets-inherit`, `overprovisioned-secrets` and `concurrency-limits`. Source: https://github.com/zizmorcore/zizmor/blob/main/docs/audits.md. It flags risky config statically and does not simulate events. **High.**
- **poutine**, Apache-2.0: a supply-chain scanner. **action-validator**, GPL-3.0: schema validation. Both from repo metadata. **High** for the licences; I did not read their features in depth.
- **GitHub Local Actions** (VS Code, Apache-2.0, last push 2025-04-05) wraps act, as the act README "TIP" box says. **github/local-action** (MIT) runs a single JS or TS *action*, not a workflow. **High.**
- **New in 2025–2026 (Show HN, Algolia search since 2025-01-01):** localci (peters/localci, MIT, created 2026-10-10), Preloop (MIT, microVM runner, "concurrency groups" honoured while running), ci-debugger (MIT, breakpoints) and actrun (Apache-2.0, archived 2026-03-31). All of them *execute* jobs. None of their READMEs mention evaluating trigger filters, fork permissions or secrets. **High** for the READMEs I grepped.
- **No "workflow simulator" or trigger dry-run tool found** on GitHub repo search, npm search or Show HN. **Unverified.** GitHub's repo search returned almost nothing for these queries, so a small tool could have been missed.
- **GitHub Community demand:** "Allow required checks to pass/skip, not fail, when using path filtering" (#44490, opened 2023-01-16) has 295 upvotes, 22 comments, and is not answered or closed (GraphQL, 2026-10-28; https://github.com/orgs/community/discussions/44490). GitHub's docs confirm the behaviour: "If a workflow is skipped due to path filtering … checks associated with that workflow will remain in a 'Pending' state" (workflow-syntax, "on.push.paths"). I found **no** 2025–2026 Community discussion asking for a workflow dry run. GraphQL discussion search returned unrelated results, so this is **Unverified**, not proof that no such request exists.

---

## 3. Gaps WhyNoRun fills

Each gap was checked against every tool above.

1. **Explaining fork-PR permissions and secrets.** No surveyed tool answers "on a PR from a fork, which jobs get which `GITHUB_TOKEN` scopes and which secrets are empty?". GitHub's own rule: "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository. The `GITHUB_TOKEN` has read-only permissions in pull requests from forked repositories" (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows, `pull_request`). wrkflw and act explicitly skip permissions. actionlint and zizmor check configuration only.
2. **Explaining concurrency cancellation.** act ignores `concurrency`, wrkflw parses it but does not enforce it, and Preloop applies it only while running real jobs. Nobody predicts "run B cancels run A because both resolve to group `ci-refs/heads/main`".
3. **Explanations that point at a YAML line.** wrkflw gives free text, act's `workflowpattern` traces name the pattern but not where it sits in the file, and Gitea and Forgejo keep no reason. `@actions/workflow-parser` keeps token ranges, so WhyNoRun can point at the exact `paths:` entry or `permissions:` key.
4. **Runs in a browser.** Only actionlint (Wasm) and GitHub's language-service playground run in a browser, and neither simulates events. A paste-your-YAML playground on GitHub Pages is new.
5. **Behaviour regression tests.** No tool saves "for event X, expect workflow W to run or skip with permissions P" and fails CI when an edit changes it. wrkflw's watch mode re-runs workflows but asserts nothing.
6. **Matching GitHub's own semantics.** WhyNoRun can build on GitHub's own parser and expression evaluator. wrkflw's matcher diverges on ordered negation and `?`/`+` (§2.1). This is a quality claim that WhyNoRun has to prove with tests (act's 64 cases plus GitHub's documented examples).
7. **The stuck required check.** Gitea fixes it on the server. On GitHub, WhyNoRun can *predict* "this required check will stay Pending for this PR" before merge, which answers the most-upvoted pain point found (#44490).

**Not original. Credit these and don't claim them:** skipping by event and changed files (wrkflw did it first), filter-pattern matching (act, Gitea), syntax and permission-name validation (actionlint), and security-hazard flags (zizmor).

---

## 4. Reuse and porting plan, with credit

| Source | What to take | How | Licence duty |
|---|---|---|---|
| `@actions/workflow-parser`, `@actions/expressions` (GitHub) | Parsing, schema validation, token ranges, `${{ }}` evaluation | npm dependency | Keep the MIT notice (it ships in the package). Credit in the README |
| act `pkg/workflowpattern` (nektos/act) | Pattern-to-regex conversion, ordered `Skip`/`Filter` semantics, trace messages | **Port to TypeScript** (about 200 lines of Go) | MIT: copy the act copyright and permission notice into the ported file or a `THIRD_PARTY_NOTICES` file. Credit in the README |
| act `workflow_pattern_test.go` | 64 table-driven cases | Port as Vitest fixtures | Same MIT notice |
| Gitea `modules/actions/workflows.go` | How push and PR filter axes combine (branch or tag, either may match; no paths check for tags; base-branch matching for PRs) | Reimplement after reading, credit the design | MIT (Gitea). If any code is copied, keep the Gitea notice |
| wrkflw trigger-filter | Edge-case list from its tests and comments (`!!` escape, strict mode on an empty diff, mutually exclusive `paths`/`paths-ignore`) | Use as a test-idea checklist only. Don't port its matcher (it diverges) | MIT. Credit as prior art |
| actionlint | Diagnostic style (`file:line:col: message [rule]`) and glob-syntax error wording | Inspiration only | Credit as prior art |
| Forgejo | Nothing | Avoid | GPL-3.0 project |

---

## 5. Attributions the README must carry

Draft "Credits and prior art" section:

> WhyNoRun builds on, and was informed by, these open-source projects:
> - **[@actions/workflow-parser](https://github.com/actions/languageservices) and @actions/expressions** by GitHub (MIT): workflow parsing and expression evaluation.
> - **[nektos/act](https://github.com/nektos/act)** (MIT): WhyNoRun's filter-pattern matcher is a TypeScript port of act's `pkg/workflowpattern`, including its test cases.
> - **[Gitea](https://github.com/go-gitea/gitea)** (MIT): the way branch, tag and path filters combine follows Gitea's Actions workflow detector.
> - **[wrkflw](https://github.com/bahdotsh/wrkflw)** (MIT): prior art for trigger-aware filtering by event and changed files.
> - **[actionlint](https://github.com/rhysd/actionlint)** (MIT) and **[zizmor](https://github.com/zizmorcore/zizmor)** (MIT): prior art for static workflow checks. Use them alongside WhyNoRun: they lint, WhyNoRun simulates.

Also keep the MIT notices for act (and Gitea, if any of its code is copied) in a `THIRD_PARTY_NOTICES` file or in the header of the ported file.

---

## 6. Open points and caveats

- I read wrkflw's two divergences (§2.1) from its source but did not run them. Before the spec cites them, run them once against wrkflw v0.8.0.
- The `ConcurrencySetting.queue` field in `@actions/workflow-parser` is not explained in GitHub docs I read. Send it to the concurrency and simulation-model ticket.
- Searching Community Discussions through the API was unreliable. The absence of 2025–2026 dry-run requests is weak evidence.
- GitHub's real trigger matcher is closed source, so "matches GitHub" can only be shown against GitHub's documentation and observed behaviour, never against GitHub's code.

---

## Verdict for the map

**Does WhyNoRun claim something original? Yes, with a narrower headline than "simulate workflows".**

- **Already done by others (credit it, don't claim it):** deciding run or skip from `on:` filters for an event plus changed files (wrkflw's `trigger-filter`, Gitea's and Forgejo's detectors), filter-pattern matching (act's `workflowpattern`), static validation (actionlint, the GitHub language service) and security linting (zizmor).
- **Done by no surveyed tool (the original claim):**
  1. Per event, which `GITHUB_TOKEN` permissions and which secrets each job gets, including fork PRs and `pull_request_target`.
  2. Predicting concurrency-group cancellations.
  3. Every verdict tied to the YAML line responsible.
  4. Running in a browser with nothing installed.
  5. Saving the expected behaviour as regression tests that fail CI.
  6. Predicting the "required check stuck on Pending" outcome on GitHub.
- **Build on:** `@actions/workflow-parser` and `@actions/expressions` (dependency) and a credited TypeScript port of act's MIT `pkg/workflowpattern` with its 64 test cases. Read Gitea's MIT detector for how filters combine. Avoid Forgejo code (GPL-3.0).
- **README must credit:** GitHub languageservices, nektos/act (ported code plus its notice), Gitea (design), wrkflw (prior art), and actionlint and zizmor (prior art).
- **For the map's pitch:** lead with fork-PR permissions and secrets, concurrency and behaviour tests, as the earlier critic notes advised. Leading with "which workflows run" alone would only match wrkflw.
