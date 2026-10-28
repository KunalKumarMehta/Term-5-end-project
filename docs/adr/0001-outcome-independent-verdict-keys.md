# Verdict keys are outcome-independent; Behaviour tests pin only value, possible and root

Behaviour tests are committed in Maintainers' own repositories, so the shape of a Verdict key is effectively a public file format. We key every Verdict by YAML identifiers only (`ci.yml › build › token.contents`, `check › CI / test`, `ci.yml › concurrency.A`), never by line numbers, YAML order or `name:` text, and the set of keys depends only on the files and the Scenario's shape, never on outcomes: a job whose GitHub workflow didn't run still gets its key, with the value `no-run`, and its access Verdicts are computed as if it runs. A Behaviour test compares only `value`, `possible` and `root` (plus `group` and `continuing` for concurrency), never the full cause chain or prose.

## Considered Options

- **Omit subjects that don't happen.** Smaller output, but one path-filter edit makes a job's 19 keys vanish and the diff becomes noise instead of one `runs → no-run` line.
- **Pin the whole Explanation.** More precise, but incidental rule IDs (which glob rule matched) would break tests on harmless edits.

## Consequences

- Renaming a job id breaks its pinned key; the test reports "pinned subject not found" with candidates and never follows renames automatically.
- Matrix legs, when they arrive after v1, become child keys such as `ci.yml › build[os=ubuntu-latest]`, so v1 pins keep working.
