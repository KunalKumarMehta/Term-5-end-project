# Changelog

All notable changes to WhyNoRun are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each release's section lands with its version-bump PR, so there is no Unreleased section.

A released rule ID never changes meaning. A release that changes any pinned
`value`, `possible` or `root` is at least a minor version, and lists each
affected rule under `### Affected rules` as `- RULE-ID: what changed`
([ADR 0002](docs/adr/0002-test-files-embed-the-core-scenario.md)).

## [0.1.0] - 2026-10-29

The first release: core flow 1, the access report, works end to end.

### Added

- The access report (core flow 1): for each job, its 17 `GITHUB_TOKEN` scopes and its secrets, computed as if the job runs, each pointing at the YAML line that decides it.
- Fork pull requests (PERM-2, FK-2), runs awaiting approval (FK-4) and Dependabot runs (FK-8).
- `pull_request_target`: its write token and secrets (FK-7), GitHub's 2 December 2026 block (PRT-2, PRT-3, PRT-4) and checkout's refusal of a fork's head (CO-1).
- Local reusable workflows, with their jobs shown under the caller (PERM-7, RU-1, RU-2), and remote reusable callers whose token scopes are Uncertain.
- Run and skip Verdicts for every GitHub workflow and job: branch and tag filters, path filters, commit-message skips, `if:`, `needs` and the "job X fails" Assumption.
- Repo facts, with unset facts taking assumed defaults (WN-5).
- Uncertain Verdicts that list their possible outcomes and name what would settle them, and Settle it.
- The playground: paste, upload or drop a folder, Load example, Diagnostics at the position GitHub would reject, Explanations that follow each cause to its YAML line, Compare two Scenarios and the All Verdicts grid.
- The CLI: `whynorun show` prints one line per GitHub workflow, job and access key (`--flow access` for the access keys only), and `whynorun --version`.
