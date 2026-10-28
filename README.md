# WhyNoRun

Know what your GitHub Actions workflows will do before you push.

**Status:** in development. End-term project, SST MERN 2029 batch.

## Problem Statement

Developers who maintain GitHub Actions workflows can't safely predict what a change will do. Path and branch filters, pull requests from forks (which get no secrets and a read-only token), matrix rules and concurrency groups interact in non-obvious ways, and GitHub has no dry run. So people push and wait, and a workflow that a filter silently skips can leave a required check stuck on "Pending", blocking merges.

WhyNoRun simulates a repository's workflows against an event you describe (a push, a fork PR, a tag, a manual dispatch). It explains every run, skip, cancellation, permission and secret by pointing at the YAML line responsible, and saves the expected behaviour as regression tests that fail CI when a workflow change alters it.

## `whynorun show`

`whynorun show --event push --date 2026-12-03` reads `.github/workflows/` in the current folder (or `--repo <dir>`) and prints one line per GitHub workflow: whether the Event runs it, its root rule ID and the YAML line. `--ref` (a branch, `refs/heads/…` or `refs/tags/…`) and `--base` give the pushed ref and a pull request's base branch for branch and tag filters; both default to the default branch. `--actor member|fork|dependabot` sets the Actor kind (a member by default). `--changed <file>` (or `-` for stdin) lists the changed files, one per line, taken as the complete diff for path filters; without it the diff is empty. It never reads git and never uses the network. Repo facts it isn't given take these assumed defaults:

<!-- show-defaults -->

- Visibility: public
- Created before 2026-09-17: yes
- Default branch: `main`
- Token default: restricted
- `pull_request_target` event policy: none
- Approval of a fork contributor's run: approved

<!-- /show-defaults -->

## What WhyNoRun always assumes

These platform conditions are taken as given and never shown as a cause:

<!-- baseline -->

- Actions are enabled for the repo, org and enterprise, and the GitHub workflow isn't disabled (PL-1, PL-2).
- The event was created: no more than 3 tags or 5,000 branches pushed at once (PL-7), and no trigger or queue rate limit is hit (PL-8).
- The event wasn't caused by `GITHUB_TOKEN` (PL-6).
- No execution-protection actor rule, no event rule other than the `pull_request_target` event policy, and no Require-lockfile policy (PL-10, PRT-6, PRT-7).
- The allowed-actions and SHA-pinning policies permit every `uses:` (PL-11).
- The pull request has no merge conflict (PL-12, DB-5).
- Environment protection rules and branch policies pass (PL-16).
- "Allow GitHub Actions to create and approve pull requests" is on (PERM-10).
- No runner-queue, run or job time limit is hit (PL-15), and there is no billing or storage stop (PL-17).

<!-- /baseline -->

## Tech Stack

- TypeScript core built on GitHub's own `@actions/workflow-parser` and `@actions/expressions`
- Node.js CLI (npm) and a JavaScript GitHub Action for CI
- React + Vite browser playground with CodeMirror, hosted on GitHub Pages
- Vitest and Playwright for testing; GitHub Actions for CI/CD
