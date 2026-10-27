# What existing workflow tools already do

Research for wayfinder ticket #4 (parent map #1). Written 2026-10-28, revised the same day after two independent checks (see "Verification notes" at the end).

**Question:** What do existing tools already do in this space, so that the WhyNoRun spec claims something original (guidelines §16) and credits anything it builds on?

**Method:** I read each tool's own repository at its default branch as of 2026-10-28: the README, the docs and the source files that implement trigger matching. Licences come from the GitHub API (`license.spdx_id`) and the LICENSE file. I searched GitHub Community Discussions (GraphQL search and web search), Hacker News "Show HN" posts since 2025-01-01 (Algolia API), GitHub repositories and npm for "dry run" and "workflow simulator" tools.

**Confidence key:** **High** means I read it in the primary source. **Medium** means I inferred it from source code without running it. **Unverified** means I looked and found nothing, which is weak evidence.

---

## 1. Comparison table

"Explains why" means the tool tells the user why a workflow **run**s or is **skip**ped by a trigger filter, why a run is **cancel**led by a concurrency group, and which **permission**s and **secret**s the run gets for the event.

| Tool | What it simulates or validates | Explains why (run / skip / cancel / permission / secret) | In a browser? | Behaviour tests? | Licence | Reusable logic |
|---|---|---|---|---|---|---|
| **wrkflw** (bahdotsh/wrkflw, main @ `248a419`, 2026-09-08, after v0.8.0) | Runs workflows locally (Docker, Podman or host emulation) and validates them. Its `wrkflw-trigger-filter` crate decides whether `on:` fires for an event and a set of changed files | **Run/skip: yes**, as a free-text `reason` string with no YAML line. **Cancel: no** (concurrency is "parsed but not enforced"). **Permission/secret: no** ("GitHub encrypted secrets and fine-grained permissions" are not yet supported) | No (Rust CLI and TUI, no Wasm target) | No | MIT, © 2025 Gokul | Its test cases and edge-case notes. The matching itself diverges from GitHub (§2.1) |
| **actrun** (mizchi/actrun, active; oda251/actrun is an archived fork) | Runs workflows locally (MoonBit). `--affected` and `--dry-run` select and plan runs. Has a `lint` command | **Run/skip: yes for push**: `matches_push_trigger` checks `branches`, `branches-ignore`, `tags`, `tags-ignore`, `paths`, `paths-ignore`. Answer is yes/no only, no reason, no ordered `!` handling. **Cancel: no.** **Permission:** static lint only (`permissive-permissions`, `missing-prt-permissions`, `dangerous-checkout-in-prt`), not per event. **Secret: no** | No | No | Apache-2.0 | Lint rule ideas. Matcher is not GitHub-ordered, don't port |
| **buildkite-gha** (buildkite/buildkite-gha, created 2026-07-22) | Runs GitHub Actions YAML as Buildkite jobs (runtime behind Buildkite's "GitHub Actions Compatibility"). `buildkite-gha validate` checks a workflow locally | **Run/skip: yes**, as a plain-English annotation capped at 70 characters ("Only runs on `main`.", "Changed paths do not match this workflow's path filters"), no YAML line. Path patterns use GitHub's ordered last-match-wins rule. **Cancel: no** (maps concurrency to Buildkite limits, warns `W_WORKFLOW_CONCURRENCY_CANCEL_IN_PROGRESS_IGNORED`). **Permission:** validates requested `GITHUB_TOKEN` scopes, no per-event explanation. **Secret/fork: no** | No | Internal fixtures only | MIT | Go ref and path glob-to-regex code with ordered negation, plus `triggers_test.go` cases. One deliberate difference: it rejects a `!` pattern with no positive pattern before it |
| **act** (nektos/act) | Runs workflows locally in Docker. `-n` turns off containers and "validates only workflow correctness" | **Run/skip:** only by event name; the planner ignores `branches`, `tags`, `paths` and `types`. Logs skips from job `if:`. **Cancel: no** (docs: "`concurrency` is ignored"). **Permission: no** (`job.permissions` is ignored). **Secret:** only what the user passes with `-s` | No | No | MIT | `pkg/workflowpattern`: a GitHub-semantics filter matcher with a trace writer and 64 test cases. Act itself never calls it |
| **actionlint** (rhysd/actionlint) | Static checks: syntax, expression types, glob syntax, permission scope names, reusable workflow inputs and secrets, shellcheck, script injection | **No.** It validates the syntax of filters and permissions but never evaluates them against an event | **Yes**: a Wasm playground at rhysd.github.io/actionlint | No | MIT, © 2021 rhysd | Model for line and column diagnostics and for glob syntax errors. Go, so it would need porting |
| **GitHub Actions for VS Code** (github/vscode-github-actions) | Authoring help (highlighting, completion, hover, validation) and run management through the API | **No** | No (it does not support github.dev or vscode.dev) | No | MIT | Use it as a reference only. Its language features come from the `actions/languageservices` packages |
| **actions/languageservices** (`@actions/workflow-parser`, `@actions/expressions`, `@actions/languageservice`, 0.3.61) | Parses and validates against GitHub's own workflow schema. Parses and evaluates `${{ }}` expressions. Ships a browser playground | **No.** `convertOn` turns `branches`, `tags`, `paths` and `types` into data, but nothing matches them against an event. The converted `WorkflowTemplate` has no `permissions` field | **Yes** (pure TypeScript ESM; the repo has a `browser-playground`) | No | MIT, © GitHub | **Direct dependency** (already WhyNoRun's planned base): the parser with token ranges for line pointers, the expression evaluator for `if:` and `concurrency.group` |
| **Gitea** workflow detector (`modules/actions/workflows.go`) | Server-side. For each push or PR event it decides which workflows match, using branch, tag, path and type filters | **Run/skip: yes, internally**: `detectMatched`, `detectNotApplicable` and `detectFilteredOut`. Filtered-out workflows post a *skipped* commit status when the check is required. It does not report a per-pattern reason to the user | No (Go server) | Internal Go tests only | MIT, © The Gitea Authors | The matching structure (each push or PR filter axis, and the "branch or tag, either may match" rule). The 2026 `workflowpattern` rewrite is MIT |
| **Forgejo** (`modules/actions/workflows.go`, Codeberg) | The same detector, forked from Gitea. It calls the Forgejo runner's copy of act's `workflowpattern` with an `EmptyTraceWriter` | No user-facing reason (the trace is thrown away) | No | Internal tests only | Project is **GPL-3.0**. This file keeps a Gitea MIT SPDX header | Prefer the MIT upstreams (act, Gitea) to stay clear of GPL |
| **zizmor** (zizmorcore/zizmor) | Static security audits: `dangerous-triggers` (`pull_request_target`, `workflow_run`), `excessive-permissions`, `secrets-inherit`, `concurrency-limits` and others | Flags risky *configuration*. It does not simulate an event or say which run gets which token or secret | No | No | MIT | Use its audit list for ideas about which hazards to explain. No code reuse planned |
| **dorny/paths-filter** (MIT, TS, ~3.4k stars, pushed 2026-09-27) | Job-level path gating at runtime inside a running workflow: the standard workaround for the stuck-Pending check (always run the workflow, gate jobs on paths) | Outputs which named filters matched. Not GitHub `on:` semantics: picomatch (`dot: true`), and a filter is true if any file matches a rule and none of the negated rules (unordered negation) | No (it is an action) | No | MIT | **Don't reuse for `on.paths`.** Credit as prior art for the job-gating workaround |
| **CircleCI, Depot CI** (closed source) | Run GitHub Actions YAML off GitHub (CircleCI open preview announced 2026-09-22), so they must evaluate triggers too | Not inspectable | No | n/a | Proprietary | None |
| **Other 2025–26 local runners**: localci, Preloop, ci-debugger | Run jobs locally or in microVMs, some with breakpoints | Execution only. None documents trigger-filter or permission explanation | No | No | MIT / MIT / MIT | None |
| **GitLab CI Lint** (other platform) | Pipeline editor "Lint CI/CD sample" can "Simulate pipeline creation for the default branch" in the browser, checking `rules` and `needs` | Simulates a default-branch push only, no per-rule explanation | **Yes** | No | GitLab | Cross-platform prior art for a paste-and-simulate page |
| **GitHub itself** | Evaluates triggers server-side | The UI shows no reason. A workflow skipped by path, branch or commit-message filtering leaves its required checks "Pending" | n/a | n/a | n/a | n/a |

---

## 2. Evidence per tool

### 2.1 wrkflw and its trigger filter

All line numbers below were read on `main` at `248a419` (2026-09-08), which is after the v0.8.0 release (2026-04-21).

- The README advertises "**Diff-aware filtering**: skip workflows whose `on:` block doesn't match the simulated event and changed file set" and a watch mode with trigger-aware filtering. Source: https://github.com/bahdotsh/wrkflw/blob/main/README.md "Features" (lines 17–18). **High.**
- The trigger filter landed in PR #91 (`154df509`, 2026-04-11, "feat: add diff-aware selective execution and watch mode"). It was **not** the first: actrun's push trigger matcher dates from 2026-03-12 (§2.6), and Gitea's detector predates both. **High.**
- Its "Not yet supported" list includes "GitHub encrypted secrets and fine-grained permissions" and "`concurrency:` groups and `cancel-in-progress`: parsed but not enforced". Source: same README, "Not yet supported" (lines 31–36). **High.**
- Strict mode rejects `--event` without `--diff` or `--changed-files`, and simulating a `pull_request` needs `--base-branch`. Source: README "Trigger-aware execution". **High.**
- The crate README says it "returns a structured reason on skip so the CLI/TUI can explain *why* a workflow was filtered out". Source: https://github.com/bahdotsh/wrkflw/blob/main/crates/trigger-filter/README.md. In the code that reason is `TriggerMatchResult { matches: bool, matched_event: Option<String>, reason: String }`, a free-text string such as `branch 'x' did not match [...]` or `activity 'y' not in [...]`. It carries no YAML line or column. Source: `crates/trigger-filter/src/model.rs` lines 303–309 and `src/eval.rs` lines 85–100 and 186–277. **High.**
- **Divergence 1, ordered negation.** `extract_glob_list` sends every `!`-prefixed entry in `paths:` into a separate exclude list (`src/parser.rs` lines 369–402), and `matches_paths` removes excluded files first and then tests the includes (`src/path_matcher.rs` lines 9–43). GitHub documents that "the order that you define `paths` patterns matters … a matching positive pattern after a negative match will include the path again" (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax, "on.push.paths", "Including and excluding paths"). So `['sub/**', '!sub/docs/**', 'sub/docs/api/**']` would include `sub/docs/api/x` on GitHub, but wrkflw would exclude it. **Medium** (read from the code, not run).
- **Divergence 2, glob dialect.** wrkflw compiles patterns with Rust's `glob` crate (`src/model.rs` lines 172–193), where "`?` matches any single character" (https://docs.rs/glob/latest/glob/struct.Pattern.html). GitHub's cheat sheet defines `?` as "zero or one of the preceding character" and `+` as "one or more of the preceding character" (workflow-syntax, "Filter pattern cheat sheet"). **Medium.**
- No browser or Wasm build: the repository tree has no `wasm`, `web` or `playground` paths (checked with `git/trees/main?recursive=1`). **High** for the tree as of today.
- Licence: MIT, "Copyright (c) 2025 Gokul" (https://github.com/bahdotsh/wrkflw/blob/main/LICENSE). **High.**

### 2.2 nektos/act

- `PlanEvent` keeps any workflow whose `on:` lists the event name. It never looks at `branches`, `paths` or `types`. Source: https://github.com/nektos/act/blob/master/pkg/model/planner.go lines 200–229. **High.**
- Issue #454, "act not honoring on.push.paths", is still **open**: https://github.com/nektos/act/issues/454. **High.**
- The `-n/--dryrun` flag "disable[s] container creation, validates only workflow correctness" (`cmd/root.go` line 107). `-l` lists workflows for an event, `-e` takes an event JSON file and `-s` passes secrets (lines 71, 78 and 88). **High.**
- The docs' "Not supported" page lists "`concurrency` is ignored", "`job.permissions` ignored", "Run steps cancellation not implemented" (this is about cancelling steps, not runs), and "`job.environment` ignored and scoping secrets by deployment environment is not supported". The "Cancel: no" verdict rests on "`concurrency` is ignored". Source: https://nektosact.com/not_supported.html. **High.**
- The only skip explanations are a job `if:` being false and an unsupported platform (`pkg/runner/run_context.go` lines 793–820). **High.**
- `pkg/workflowpattern` (added in PR #1618, 2023-02-23) implements GitHub's filter-pattern-to-regex conversion with ordered `!` handling: in `Skip`, the last pattern that matches wins. A `TraceWriter` logs "`<file> included by pattern <p>`", "excluded by" and "ignored by". It has 64 table-driven cases in `workflow_pattern_test.go`. The PR says it is meant "to detect if we should skip the workflow". Act never wired it in. The Forgejo runner and Forgejo use it; Gitea used it until 2026 and now has its own MIT rewrite (§2.5). Sources: https://github.com/nektos/act/blob/master/pkg/workflowpattern/workflow_pattern.go lines 15–196, https://github.com/nektos/act/pull/1618. **High.**
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
- The same file defines `ConcurrencySetting { group, cancelInProgress, queue?: "single" | "max" }` (lines 21–27). This **is documented**: GitHub added `concurrency.queue` on 2026-05-07 (https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/). The workflow-syntax `concurrency` and `jobs.<job_id>.concurrency` sections say: "`single` (default): At most one job or workflow run can be `pending` in the concurrency group. When a new job or workflow run is queued, any existing `pending` job or workflow run in the same group is canceled and replaced." "`max`: Up to 100 jobs or workflow runs can be `pending` in the concurrency group. When the queue is full, any additional jobs or workflow runs are canceled." "The combination of `queue: max` and `cancel-in-progress: true` is not allowed and will result in a workflow validation error." **High.** Gitea does not support `queue: max` yet (go-gitea/gitea#39195).
- The runner (`actions/runner`) contains the workflow schema JSON but no filter-matching code, so the matching that decides triggers runs in GitHub's closed service. Source: code search of `actions/runner` for `paths-ignore` and `branches-ignore` found only `src/Sdk/WorkflowParser/workflow-v1.0.json` and a build workflow. **Medium.**

### 2.5 Gitea and Forgejo workflow detectors

- Gitea's `DetectWorkflows` returns `workflows`, `schedules`, `filtered` and `invalid`. `detectFilteredOut` means the workflow "matched but [was] excluded by a branch/paths filter; posts a skipped commit status when the context is a required check". So Gitea fixes the stuck-"Pending" problem on the server, and GitHub does not. Source: https://github.com/go-gitea/gitea/blob/main/modules/actions/workflows.go lines 36–42 and 180–240. **High.**
- `matchPushEvent` requires every filter key to match, except that when both branch and tag filters exist only one needs to match. Paths are skipped for tag pushes. Source: same file, lines 390–497. **High.**
- Gitea replaced act's matcher with its own `modules/actions/workflowpattern` ("Copyright 2026 The Gitea Authors", MIT, 65 lines, glob-based, two-argument `Skip`, no trace writer). It moved from the nektos/act fork to gitea/runner (97211bf0, 2026-05-06), then into `modules/actions` (16189a68, 2026-05-16). Source: https://github.com/go-gitea/gitea/blob/main/modules/actions/workflowpattern/workflow_pattern.go. **High.**
- Recent changes include resolving `pull_request_target` reusable workflows at the base commit (8161479f, 2026-08-12) and YAML anchors (ed4d7ea0, 2026-08-20), from the commit history of that file. These are useful hints for edge cases. **High.**
- Forgejo's copy imports `code.forgejo.org/forgejo/runner/v13/act/workflowpattern` and passes `&workflowpattern.EmptyTraceWriter{}`. Source: https://codeberg.org/forgejo/forgejo/src/branch/forgejo/modules/actions/workflows.go lines 21 and 318–391. The Forgejo repository LICENSE is GPL-3.0 (https://codeberg.org/forgejo/forgejo/src/branch/forgejo/LICENSE), although this file keeps Gitea's MIT SPDX header. **High.**

### 2.6 Other tools and 2025–2026 "dry run" searches

- **actrun** (https://github.com/mizchi/actrun; Apache-2.0, 673 stars, active, last push 2026-10-03). The copy at oda251/actrun is a fork (`parent: mizchi/actrun`) and is archived; an earlier version of this note cited the fork by mistake. The README lists "Push trigger filter (`branches`, `paths`)" under Workflow Features. `src/trigger.mbt` ("Push trigger matcher") has `matches_push_trigger`, which checks `tags`, `tags-ignore`, `branches`, `branches-ignore`, `paths` and `paths-ignore` (lines 74–97) and returns a bare `Bool`. Each list is matched with "any pattern matches", so ordered `!` patterns are not handled. `--affected` falls back to `on:push:paths`, and `--dry-run` "shows plan even if skipped". Its lint rules include `invalid-glob` ("Invalid glob pattern in trigger filter"), `permissive-permissions`, `missing-prt-permissions` and `dangerous-checkout-in-prt`. The matcher dates from the initial commit (4d4369e7, 2026-03-12), with "pull_request trigger" and "push.tags" added 2026-03-15 (27ada632). **High** for the source; **Medium** for behaviour (not run).
- **buildkite-gha** (https://github.com/buildkite/buildkite-gha; MIT, Go, created 2026-07-22, last push 2026-10-27). The open-source runtime behind Buildkite's "GitHub Actions Compatibility". `internal/buildkite/triggers.go`: `TriggerFilterMismatchReason` (lines 353–495) returns user-facing reasons such as "Only runs on `main`.", "Base branch \"x\" does not match this workflow's pull_request branch filters." and "Changed paths do not match this workflow's path filters" (line 489), capped by `maxSkipReasonLength = 70` (line 15). `pathFiltersMatch` (lines 946–1016) compiles each pattern to a regex and lets the last matching pattern win (GitHub's ordered rule), and returns an error for "negative pattern … must follow a positive pattern" and for combining include and ignore lists. Concurrency maps to Buildkite limits with a `W_WORKFLOW_CONCURRENCY_CANCEL_IN_PROGRESS_IGNORED` warning (`internal/plan/plan.go` lines 1392–1410). **High** for the source read; **Medium** for behaviour (not run).
- **CircleCI** announced an open preview of running GitHub Actions YAML on CircleCI on 2026-09-22 (https://circleci.com/blog/github-actions-alternative-run-actions-on-circleci/). **Depot CI** also runs GitHub Actions YAML. Both are closed source, so their trigger evaluation cannot be inspected or reused. **Medium** (vendor material only).
- **dorny/paths-filter** (https://github.com/dorny/paths-filter; MIT, TypeScript, 3,381 stars, pushed 2026-09-27). Matches with picomatch `^4.0.7` (`dot: true`). A filter is true if any changed file matches at least one rule and none of the negated rules (README lines 74–76, 184, 209–210). That is not GitHub's ordered `on.paths` semantics, so it looks reusable but is wrong for `on:`. It is the standard workaround in #13690 and #44490. **High.**
- **zizmor**, MIT, 6.8k stars: audits include `dangerous-triggers` (`pull_request_target`, `workflow_run`), `excessive-permissions`, `secrets-inherit`, `overprovisioned-secrets` and `concurrency-limits`. Source: https://github.com/zizmorcore/zizmor/blob/main/docs/audits.md. It flags risky config statically and does not simulate events. **High.**
- **poutine**, Apache-2.0: a supply-chain scanner. **action-validator**, GPL-3.0: schema validation. Both from repo metadata. **High** for the licences; I did not read their features in depth.
- **GitHub Local Actions** (VS Code, Apache-2.0, last push 2025-04-05) wraps act, as the act README "TIP" box says. **github/local-action** (MIT) runs a single JS or TS *action*, not a workflow. **High.**
- **Other 2025–2026 runners (Show HN, Algolia search since 2025-01-01):** localci (peters/localci, MIT, created 2026-10-10), Preloop (MIT, microVM runner, "concurrency groups" honoured while running) and ci-debugger (MIT, breakpoints). All of them *execute* jobs. None of their READMEs mention evaluating trigger filters, fork permissions or secrets. **High** for the READMEs I grepped.
- **GitLab CI Lint** (other platform): the pipeline editor's "Lint CI/CD sample" can "Simulate pipeline creation for the default branch", checking `rules` and `needs` logic in the browser (https://docs.gitlab.com/ci/yaml/lint/). It simulates only a default-branch push and gives no per-rule explanation. **High.**
- **No GitHub Actions "workflow simulator" that explains permissions, secrets or concurrency** was found on GitHub repo search, npm search or Show HN. **Unverified.** GitHub's repo search returned almost nothing for these queries, so a small tool could have been missed (buildkite-gha and actrun were both missed by the first pass).
- **GitHub Community demand:**
  - "Required actions workflows from branch protections should only be required if run" (#13690, opened 2022-03-28): 365 upvotes, 50 comments, not answered, open (GraphQL, 2026-10-28; https://github.com/orgs/community/discussions/13690). **High.**
  - "Allow required checks to pass/skip, not fail, when using path filtering" (#44490, opened 2023-01-16): 295 upvotes, 22 comments, not answered or closed (https://github.com/orgs/community/discussions/44490). **High.**
  - GitHub's "Handling skipped but required checks" table (https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) gives three outcomes: a workflow skipped by path filtering, branch filtering or a commit message leaves checks "Pending" and blocks merging; a job skipped by a conditional "reports Success"; a job that depends on a failed job "is skipped and may not block merging". **High.**
  - No 2025–26 request asks for a dry-run tool by name, but "why didn't my workflow trigger" threads recur: #164673 (2025-07-01, path-only triggering; the answer warns a path-skipped workflow never reports a status), #179965 (2025-11-19, push + paths not triggered on squash merge), #206064 (2026-08-28, `pull_request` workflows not triggered), #211326 (2026-10-26) and #211380 (2026-10-27), both about scheduled events not being created. Upvote counts are low (1–3), so this is evidence of recurring confusion, not ranked demand. **High** for the metadata.

---

## 3. Gaps WhyNoRun fills

Each gap was checked against every tool above.

1. **Explaining, per event and per repository setting, which token scopes and secrets each job gets.** No surveyed tool answers "on this PR, which jobs get which `GITHUB_TOKEN` scopes and which secrets are empty?". GitHub's *default* rule: "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository. The `GITHUB_TOKEN` has read-only permissions in pull requests from forked repositories" (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows, `pull_request`). It is only a default, so the simulator needs these inputs and rules:
   - **Repository visibility** and the **fork-PR settings** for private and internal repos: run workflows from fork PRs, "Send write tokens to workflows from pull requests", "Send secrets to workflows from pull requests", and the approval requirement for fork PR workflows (also applies to some public-repo contributors). Source: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository.
   - **Dependabot as the actor**: "Workflows triggered by Dependabot pull requests are treated as though they are from a forked repository". Dependabot runs get a read-only token by default and only Dependabot secrets, not Actions secrets. With `pull_request_target`, if the base ref was created by Dependabot, the token is read-only and no secrets are available (https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-on-actions).
   - **`pull_request_target` runs from the default branch**: since 2025-12-08 the workflow file and checkout come from the default branch, and `GITHUB_REF`/`GITHUB_SHA` point at it. Environment branch-protection rules for `pull_request` events now evaluate against `refs/pull/N/merge`, which changes which jobs can reach environment secrets (https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/).
   - **`workflow_run`** privilege rules, kept separate from `pull_request`.
   - **Predicted failure, actions/checkout v7**: since 2026-06-18 it refuses to check out fork PR head or merge refs in `pull_request_target`, and in `workflow_run` triggered by a `pull_request`, unless `allow-unsafe-pr-checkout` is set. The change was backported to the other supported major versions (not v1), enforced from 2026-07-20 (https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/).

   wrkflw, act, actrun and buildkite-gha do not model any of this. actionlint, actrun's lint and zizmor's `dangerous-triggers` flag risky configuration but compute none of it. The gap stands, and its scope is larger than a single fork rule.
2. **Explaining concurrency cancellation.** act ignores `concurrency`, wrkflw parses it but does not enforce it, buildkite-gha maps it to Buildkite limits and ignores `cancel-in-progress`, and Preloop applies it only while running real jobs. Nobody predicts the three documented cases: (1) **in-progress cancellation** with `cancel-in-progress: true` ("run B cancels run A because both resolve to group `ci-refs/heads/main`"); (2) under the default `queue: single`, a **pending run cancelled and replaced** by a newer one; (3) under `queue: max`, the **queue position** (FIFO up to 100) and **overflow cancellation**. `queue: max` with `cancel-in-progress: true` is a validation error that WhyNoRun should report.
3. **Explanations that point at a YAML line.** wrkflw gives free text, buildkite-gha gives a 70-character sentence, actrun gives yes/no, act's `workflowpattern` traces name the pattern but not where it sits in the file, and Gitea and Forgejo keep no reason. `@actions/workflow-parser` keeps token ranges, so WhyNoRun can point at the exact `paths:` entry or `permissions:` key.
4. **Runs in a browser, for GitHub Actions.** Only actionlint (Wasm) and GitHub's language-service playground run in a browser, and neither simulates events. A paste-your-YAML playground on GitHub Pages is new **for GitHub Actions**. GitLab's CI Lint "Simulate pipeline creation" is cross-platform prior art, but it only simulates a default-branch push and gives no per-rule explanation.
5. **Behaviour regression tests.** No tool saves "for event X, expect workflow W to run or skip with permissions P" and fails CI when an edit changes it. wrkflw's watch mode re-runs workflows but asserts nothing. buildkite-gha's fixtures test its own code, not the user's workflows.
6. **Matching GitHub's own semantics.** WhyNoRun can build on GitHub's own parser and expression evaluator. wrkflw's matcher diverges on ordered negation and `?`/`+` (§2.1), actrun has no ordered negation, and dorny/paths-filter uses unordered negation. buildkite-gha does use the ordered rule, so this gap is a quality claim, not a uniqueness claim. WhyNoRun has to prove it with tests (act's 64 cases, buildkite-gha's trigger tests and GitHub's documented examples).
7. **Predicting required-check outcomes.** Gitea fixes the stuck check on the server. On GitHub, WhyNoRun can *predict* the outcome before merge, following GitHub's "Handling skipped but required checks" table: a workflow-level skip from path, branch or commit message gives **Pending and blocks**; a job-level `if:` skip gives **Success**; a job skipped after a failed `needs` job **may not block**. It should also recognise and explain the usual workaround (always run the workflow, gate jobs with `if:` or dorny/paths-filter). This answers the two most-upvoted pain points found (#13690, 365; #44490, 295).
8. **Event-level preconditions that no tool models.** wrkflw, act, actrun, Gitea and buildkite-gha all match patterns against a file list given by the caller. GitHub documents more rules (workflow-syntax "on.push.paths" and events-that-trigger-workflows):
   - changed files come from a **two-dot diff** for pushes (for a new branch, against the parent of the ancestor of the deepest pushed commit) and a **three-dot diff** for PRs;
   - a push with **more than 1,000 commits** always runs; a **diff timeout** always runs;
   - with **more than 3,000 changed files** (300 on older GHES), the workflow does not run if its matches are not in the first 3,000;
   - **no changed files** means paths-filtered workflows do not run;
   - pushing or creating **more than three tags at once** creates no event;
   - a PR with a **merge conflict** does not run `pull_request` but does run `pull_request_target`;
   - `[skip ci]` and the other **skip markers** affect only `push` and `pull_request`;
   - events caused by **`GITHUB_TOKEN`** create no runs, except `workflow_dispatch` and `repository_dispatch`; PRs opened or updated by bots with `GITHUB_TOKEN` create runs that **need approval** (since 2026-06-11, https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/).

   **Proposed v1 scope:** the empty-diff rule, the >3-tags rule, merge-conflict suppression, skip markers, and `GITHUB_TOKEN` recursion and approval. They are declarative and need only event inputs. **Possible expansion:** computing the diff base from git history, and the 1,000-commit, timeout and 3,000-file limits (they need real repository data). The scoping ticket decides.

**Not original. Credit these and don't claim them:** deciding run or skip from `on:` filters plus changed files (Gitea's and Forgejo's server-side detectors first, then actrun, wrkflw and buildkite-gha), human-readable skip reasons (buildkite-gha, and wrkflw's free-text reason), filter-pattern matching (act, Gitea, buildkite-gha), syntax and permission-name validation (actionlint), security-hazard flags (zizmor, actrun's lint), job-level path gating (dorny/paths-filter), and browser pipeline simulation on another platform (GitLab CI Lint).

**Possible expansion (out of scope for now, listed so the map can pick them up):** explaining `schedule` triggers (default-branch-only runs, auto-disable after inactivity; see #211326 and #211380), and the diff-base and size-limit rules in gap 8.

---

## 4. Reuse and porting plan, with credit

| Source | What to take | How | Licence duty |
|---|---|---|---|
| `@actions/workflow-parser`, `@actions/expressions` (GitHub) | Parsing, schema validation, token ranges, `${{ }}` evaluation | npm dependency | Keep the MIT notice (it ships in the package). Credit in the README |
| act `pkg/workflowpattern` (nektos/act) | Pattern-to-regex conversion, ordered `Skip`/`Filter` semantics, trace messages | **Port to TypeScript** (about 200 lines of Go) | MIT: copy the act copyright and permission notice into the ported file or a `THIRD_PARTY_NOTICES` file. Credit in the README |
| act `workflow_pattern_test.go` | 64 table-driven cases | Port as Vitest fixtures | Same MIT notice |
| buildkite-gha `internal/buildkite/triggers_test.go` | A second set of trigger fixtures (ref and path globs, ordered negation, activity types) | Port selected cases as Vitest fixtures. Note its deliberate difference: it rejects a leading `!` pattern | MIT: keep the Buildkite notice in `THIRD_PARTY_NOTICES` if cases are copied. Credit in the README |
| Gitea `modules/actions/workflows.go` | How push and PR filter axes combine (branch or tag, either may match; no paths check for tags; base-branch matching for PRs) | Reimplement after reading, credit the design | MIT (Gitea). If any code is copied, keep the Gitea notice |
| wrkflw trigger-filter | Edge-case list from its tests and comments (`!!` escape, strict mode on an empty diff, mutually exclusive `paths`/`paths-ignore`) | Use as a test-idea checklist only. Don't port its matcher (it diverges) | MIT. Credit as prior art |
| actrun | Lint rule ideas (`missing-prt-permissions`, `dangerous-checkout-in-prt`) | Inspiration only. Don't port its matcher (no ordered negation) | Apache-2.0. Credit as prior art |
| actionlint | Diagnostic style (`file:line:col: message [rule]`) and glob-syntax error wording | Inspiration only | Credit as prior art |
| dorny/paths-filter, picomatch | Nothing for `on.paths` (unordered negation) | **Do not reuse** for `on:` matching | Credit paths-filter as prior art for the job-gating workaround |
| Forgejo | Nothing | Avoid | GPL-3.0 project |

---

## 5. Attributions the README must carry

Draft "Credits and prior art" section:

> WhyNoRun builds on, and was informed by, these open-source projects:
> - **[@actions/workflow-parser](https://github.com/actions/languageservices) and @actions/expressions** by GitHub (MIT): workflow parsing and expression evaluation.
> - **[nektos/act](https://github.com/nektos/act)** (MIT): WhyNoRun's filter-pattern matcher is a TypeScript port of act's `pkg/workflowpattern`, including its test cases.
> - **[buildkite-gha](https://github.com/buildkite/buildkite-gha)** (MIT): additional trigger test cases, and prior art for plain-English skip reasons.
> - **[Gitea](https://github.com/go-gitea/gitea)** (MIT): the way branch, tag and path filters combine follows Gitea's Actions workflow detector.
> - **[wrkflw](https://github.com/bahdotsh/wrkflw)** (MIT) and **[actrun](https://github.com/mizchi/actrun)** (Apache-2.0): prior art, with Gitea, Forgejo and buildkite-gha, for deciding run or skip from `on:` filters and changed files.
> - **[actionlint](https://github.com/rhysd/actionlint)** (MIT) and **[zizmor](https://github.com/zizmorcore/zizmor)** (MIT): prior art for static workflow checks. Use them alongside WhyNoRun: they lint, WhyNoRun simulates.
> - **[dorny/paths-filter](https://github.com/dorny/paths-filter)** (MIT): prior art for the job-level path-gating workaround that WhyNoRun explains.
> - **GitLab CI Lint** pipeline simulation: cross-platform prior art for simulating a pipeline in the browser.

Also keep the MIT notices for act (and Gitea or buildkite-gha, if any of their code or test cases are copied) in a `THIRD_PARTY_NOTICES` file or in the header of the ported file.

---

## 6. Open points and caveats

- I read wrkflw's two divergences (§2.1) from its source on `main` @ `248a419` (2026-09-08) but did not run them. Before the spec cites them, run them once against that same build, not against v0.8.0.
- I did not run actrun or buildkite-gha either. Their behaviour above is read from source.
- The concurrency `queue` option is now confirmed (§2.4). The concurrency and simulation-model ticket must take as requirements: `single` (default, one pending slot, newer replaces older), `max` (FIFO up to 100, overflow cancelled), and the validation error for `queue: max` with `cancel-in-progress: true`.
- The fork-PR model (gap 1) depends on repository settings that a pasted YAML file does not contain. The UI must ask for them (visibility, fork-PR settings, actor) or state the default it assumes.
- Searching Community Discussions through the API was unreliable, and the first survey pass missed two relevant tools. Treat "no tool does X" as strong only where a tool was read and shown not to do X.
- GitHub's real trigger matcher is closed source, so "matches GitHub" can only be shown against GitHub's documentation and observed behaviour, never against GitHub's code. The same holds for CircleCI and Depot CI.

---

## Verdict for the map

**Does WhyNoRun claim something original? Yes, with a narrower headline than "simulate workflows" or "explain why a workflow skipped".**

- **Already done by others (credit it, don't claim it):** deciding run or skip from `on:` filters for an event plus changed files (Gitea and Forgejo detectors, actrun, wrkflw, buildkite-gha), plain-English skip reasons without a YAML pointer (buildkite-gha, wrkflw), filter-pattern matching with GitHub's ordered rule (act's `workflowpattern`, buildkite-gha), static validation (actionlint, the GitHub language service), security linting (zizmor, actrun's lint), job-level path gating (dorny/paths-filter), and browser pipeline simulation on GitLab.
- **Done by no surveyed tool (the original claim):**
  1. Per event **and per repository setting**, which `GITHUB_TOKEN` permissions and which secrets each job gets: fork PRs, Dependabot, `pull_request_target` from the default branch, `workflow_run`, and the actions/checkout v7 refusal as a predicted failure.
  2. Predicting concurrency outcomes: in-progress cancellation, pending-run replacement under `queue: single`, and queue position and overflow under `queue: max`.
  3. Every verdict tied to the YAML line responsible.
  4. Running in a browser with nothing installed, for GitHub Actions.
  5. Saving the expected behaviour as regression tests that fail CI.
  6. Predicting required-check outcomes on GitHub (Pending and blocking, Success, or may not block), and explaining the paths-filter workaround.
  7. Event-level preconditions: empty diff, >3 tags, merge conflict, skip markers, `GITHUB_TOKEN` recursion and bot-PR approval.
- **Build on:** `@actions/workflow-parser` and `@actions/expressions` (dependency), a credited TypeScript port of act's MIT `pkg/workflowpattern` with its 64 test cases, and selected buildkite-gha trigger test cases (MIT). Read Gitea's MIT detector for how filters combine. Avoid Forgejo code (GPL-3.0). Do not use picomatch or paths-filter for `on.paths`.
- **README must credit:** GitHub languageservices, nektos/act (ported code plus its notice), buildkite-gha, Gitea (design), wrkflw and actrun (prior art), actionlint and zizmor (prior art), dorny/paths-filter (prior art) and GitLab CI Lint (cross-platform prior art).
- **For the map's pitch:** lead with per-event, per-setting permissions and secrets, concurrency prediction, required-check prediction and behaviour tests. Leading with "which workflows run and why" alone would only match buildkite-gha, wrkflw and actrun.
- **Possible expansion (out of scope for now):** `schedule` explanations, diff-base computation from git history, and the 1,000-commit, timeout and 3,000-file limits.

---

## Verification notes

Two independent checkers reviewed the first draft. I re-checked every correction that contradicted the note against the primary source before applying it. All 15 issues were applied (some overlapped between the checkers); none was rejected.

- **actrun.** `gh api repos/oda251/actrun` → `fork: true, archived: true, parent: mizchi/actrun`. `gh api repos/mizchi/actrun` → Apache-2.0, 673 stars, not archived, pushed 2026-10-03. Read `src/trigger.mbt` lines 74–97 (`matches_push_trigger`). Commit history of that file starts at 4d4369e7 (2026-03-12). The earlier claim that it was archived and execution-only was wrong.
- **"wrkflw did it first".** wrkflw's `crates/trigger-filter` first commit is 154df509 (2026-04-11), after actrun (2026-03-12) and far after Gitea. Removed.
- **buildkite-gha.** `gh api` → MIT, created 2026-07-22, pushed 2026-10-27. Read `internal/buildkite/triggers.go`: `maxSkipReasonLength = 70` (line 15), the reason strings (lines 353–495), and `pathFiltersMatch` with last-match-wins and the leading-`!` error (lines 946–1016). Confirmed.
- **Concurrency `queue`.** Fetched the workflow-syntax article body: the `single`/`max` text and the validation-error sentence are present in both the workflow-level and job-level `concurrency` sections. The 2026-05-07 changelog URL resolves. "Unverified" was wrong.
- **Fork-PR exceptions.** The events-that-trigger-workflows article contains "Workflows triggered by Dependabot pull requests are treated as though they are from a forked repository". The 2025-11-07 and 2026-06-18 changelogs resolve. The latter says checkout v7 "refuses common pwn request patterns by default" and that the backport covers all supported versions except v1, enforced from 2026-07-20. I wrote "other supported major versions (not v1)" rather than the checker's "floating major tags".
- **#13690.** GraphQL on 2026-10-28: 365 upvotes, 50 comments, not answered, open. #44490 still 295. The five 2025–26 threads exist with the titles and dates quoted.
- **Skipped-but-required table and event preconditions.** Fetched the troubleshooting-required-status-checks article (three rows quoted in §2.6) and the workflow-syntax and events articles (two-dot/three-dot diffs, 1,000 commits, 3,000 files, more than three tags, merge conflict). All present.
- **dorny/paths-filter.** `gh api` → MIT, 3,381 stars, pushed 2026-09-27. I did not re-read its README lines; the unordered-negation description comes from the checker and matches the project's documented behaviour.
- **Gitea workflowpattern move.** Commit history shows 16189a68 (2026-05-16) "move `workflowpattern` into `modules/act…`". §2.2 now agrees with §2.5.
- **act "Run steps cancellation".** Quote kept exactly; the Cancel verdict now rests on "`concurrency` is ignored".
- **wrkflw version.** `main` is at `248a419` (2026-09-08), after v0.8.0. Line numbers are now labelled with that commit.
- **Not re-checked by me:** CircleCI and Depot CI details (vendor material), GitLab CI Lint wording (checker-quoted docs), the repository fork-PR settings page wording, and the bot-created-PR changelog body (URL resolves).
