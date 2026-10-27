# WhyNoRun

Know what your GitHub Actions workflows will do before you push.

**Status:** in development. End-term project, SST MERN 2029 batch.

## Problem Statement

Developers who maintain GitHub Actions workflows can't safely predict what a change will do. Path and branch filters, pull requests from forks (which get no secrets and a read-only token), matrix rules and concurrency groups interact in non-obvious ways, and GitHub has no dry run. So people push and wait, and a workflow that a filter silently skips can leave a required check stuck on "Pending", blocking merges.

WhyNoRun simulates a repository's workflows against an event you describe (a push, a fork PR, a tag, a manual dispatch). It explains every run, skip, cancellation, permission and secret by pointing at the YAML line responsible, and saves the expected behaviour as regression tests that fail CI when a workflow change alters it.

## Tech Stack

- TypeScript core built on GitHub's own `@actions/workflow-parser` and `@actions/expressions`
- Node.js CLI (npm) and a composite GitHub Action for CI
- React + Vite browser playground with CodeMirror, hosted on GitHub Pages
- Vitest and Playwright for testing; GitHub Actions for CI/CD
