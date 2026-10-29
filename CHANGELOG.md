# Changelog

All notable changes to WhyNoRun are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each release's section lands with its version-bump PR, so there is no Unreleased section.

A released rule ID never changes meaning. A release that changes any pinned
`value`, `possible` or `root` is at least a minor version, and lists each
affected rule under `### Affected rules` as `- RULE-ID: what changed`
([ADR 0002](docs/adr/0002-test-files-embed-the-core-scenario.md)).

## [0.2.0] - 2026-10-29

Core flow 2, the merge-readiness check, works end to end.

### Added

- The merge-readiness check (core flow 2): each required check gets a `check › <name>` Verdict, Passes, Pending and blocks merge, Fails and blocks merge, May not block or Uncertain, worked out from the job whose check name it is (RQ-0).
- A GitHub workflow skipped by a path, branch or commit-message filter leaves its required checks Pending and blocks merge (RQ-1), quoting GitHub's advice (RQ-8). A job skipped by its own `if:` passes (RQ-2), one skipped because a `needs` dependency failed may not block (RQ-3), and a failing job or the "job X fails" Assumption fails and blocks merge (RQ-4). A fork run awaiting approval leaves its checks Pending (FK-4).
- Uncertain checks: duplicate or case-only name matches and a producer whose file has a Diagnostic (RQ-0), a job `name:` the Scenario can't evaluate (WN-4), and names matched only through a matrix job (RQ-9) or a remote reusable caller (WN-6).
- Same-repo and Dependabot pull requests also count checks from the push of their head branch, reusing the pull request's changed files (PA-4).
- The merge queue: with it on, checks must also pass on a synthesised `merge_group` run (EV-6, BR-10), and a merge group no GitHub workflow runs for leaves them Pending (RQ-6).
- Local reusable workflows' checks are named `<caller job name> / <callee job name>` (RQ-9). Strict mode notes that a pull request behind its base must pass again once brought up to date (RQ-10).
- The playground's Merge readiness tab, with required checks as chips in Repo facts and atop the tab, strict or loose, the merge-queue toggle, "Require every produced check", and ◆ under Compare. All Verdicts groups the checks under Required checks.
- Rules RQ-0, RQ-1, RQ-2, RQ-3, RQ-4, RQ-6, RQ-8, RQ-9, RQ-10, EV-6, BR-10 and PA-4.

### Fixed

- A job skipped because a `needs` dependency failed is put down to that dependency even when its `if:` reads the dependency's outputs: they are now read as a success would set them, not left empty.

### Affected rules

- JG-3: a job whose `if:` reads a failed need's outputs, such as the example's `ci.yml › e2e` with the "`ci.yml › changes` fails" Assumption, is no longer rooted in its own `if:` (JG-3); its root now follows the failed need, here WN-1.

## [0.1.0] - 2026-10-29

The first release: core flow 1, the access report, works end to end.

### Added

- The access report (core flow 1): for each job, its 17 `GITHUB_TOKEN` scopes and its secrets, computed as if the job runs, each pointing at the YAML line that decides it.
- Fork pull requests (PERM-2, FK-2), runs awaiting approval (FK-4) and Dependabot runs (FK-8).
- `pull_request_target`: its write token and secrets (FK-7), GitHub's 2 December 2026 block (PRT-2, PRT-3, PRT-4) and checkout's refusal of a fork's head (CO-1).
- Local reusable workflows, with their jobs shown under the caller (PERM-7, RU-1, RU-2) and reading `inputs.*` from the caller job's `with:` or the declared defaults, and remote reusable callers whose token scopes are Uncertain.
- Run and skip Verdicts for every GitHub workflow and job: branch and tag filters, path filters, commit-message skips, `if:`, `needs` and the "job X fails" Assumption.
- Repo facts, with unset facts taking assumed defaults (WN-5).
- Uncertain Verdicts that list their possible outcomes and name what would settle them, and Settle it. A value Settle it can't store is refused in its box and changes nothing.
- The playground: paste, upload or drop a folder, Load example, Diagnostics at the position GitHub would reject, Explanations that follow each cause to its YAML line, Compare two Scenarios and the All Verdicts grid.
- The CLI: `whynorun show` prints one line per GitHub workflow, job and access key (`--flow access` for the access keys only), and `whynorun --version`.
