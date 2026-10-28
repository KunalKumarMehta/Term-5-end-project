// The rule catalogue: one entry per rule ID the model cites. A released ID never changes
// meaning and a retired ID is never reused (ADR 0002). Each ticket adds the rows it emits.

export interface Rule {
  id: string;
  text: string;
  url: string;
  confidence: "High" | "Med" | "Low";
}

const rows: Rule[] = [
  {
    id: "EV-0",
    text: "A run is created only for GitHub workflows whose `on:` lists the triggering event; an event not listed creates no run.",
    url: "https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows",
    confidence: "High",
  },
  {
    id: "EV-1",
    text: "`pull_request` with no `types:` runs only for the `opened`, `synchronize` and `reopened` activity types; any other activity needs an explicit `types:` entry.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request",
    confidence: "High",
  },
  {
    id: "EV-4",
    text: "The parser accepts a `stacked` activity type for `pull_request`, but GitHub's docs don't list it: valid syntax with undocumented meaning.",
    url: "https://github.com/actions/languageservices/blob/4043eda/workflow-parser/src/workflow-v1.0.json",
    confidence: "Med",
  },
  {
    id: "BR-1",
    text: "`branches` and `branches-ignore` can't both appear on one event, and neither can `tags` and `tags-ignore`: GitHub rejects the file.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushbranchestagsbranches-ignoretags-ignore",
    confidence: "High",
  },
  {
    id: "BR-2",
    text: "For `pull_request`, branch filters match the pull request's base branch.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpull_requestpull_request_targetbranchesbranches-ignore",
    confidence: "High",
  },
  {
    id: "BR-3",
    text: "For `push`, filters match the pushed ref's name: with only branch filters a tag push doesn't run, and with only tag filters a branch push doesn't run.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushbranchestagsbranches-ignoretags-ignore",
    confidence: "High",
  },
  {
    id: "BR-4",
    text: "`branches` and `tags` patterns are tried in order and the last match wins: a `!` pattern excludes a ref an earlier pattern matched, and a later positive pattern includes it again.",
    url: "https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow",
    confidence: "High",
  },
  {
    id: "BR-5",
    text: "`branches-ignore` and `tags-ignore` skip the GitHub workflow when any pattern matches the ref.",
    url: "https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow",
    confidence: "High",
  },
  {
    id: "BR-6",
    text: "With both a branch or tag filter and a path filter on one event, both must pass for the GitHub workflow to run.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore",
    confidence: "High",
  },
  {
    id: "BR-8",
    text: "GitHub's docs match patterns against the ref's short name and don't say whether a full `refs/heads/\u2026` pattern matches too.",
    url: "https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow",
    confidence: "Low",
  },
  {
    id: "GL-1",
    text: "In a filter pattern `*` matches any characters except `/`, and `**` matches any characters including `/`.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet",
    confidence: "High",
  },
  {
    id: "GL-2",
    text: "In a filter pattern `?` means zero or one of the preceding character, and `+` one or more of it.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet",
    confidence: "High",
  },
  {
    id: "GL-3",
    text: "In a filter pattern `[]` matches one alphanumeric character from a set or an `a-z`, `A-Z` or `0-9` range.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet",
    confidence: "High",
  },
  {
    id: "GL-4",
    text: "In a filter pattern `!` has meaning only as the first character, and `\\` makes the next character literal.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet",
    confidence: "High",
  },
  {
    id: "GL-5",
    text: "A filter pattern starting with `*`, `[` or `!` must be quoted: unquoted, the YAML doesn't parse and the GitHub workflow doesn't run.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet",
    confidence: "High",
  },
  {
    id: "GL-6",
    text: "GitHub's docs don't say whether filter patterns are case-sensitive.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet",
    confidence: "Low",
  },
  {
    id: "PA-1",
    text: "`paths` and `paths-ignore` can't both appear on one event: GitHub rejects the file.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore",
    confidence: "High",
  },
  {
    id: "PA-2",
    text: "With `paths`, the GitHub workflow runs if at least one changed file matches, the patterns tried in order with the last match winning. With `paths-ignore`, it is skipped only if every changed file matches.",
    url: "https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow",
    confidence: "High",
  },
  {
    id: "PA-3",
    text: "With a path filter, if no files changed the GitHub workflow doesn't run.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#git-diff-comparisons",
    confidence: "High",
  },
  {
    id: "PA-5",
    text: "A diff of more than 3,000 files runs a `paths` GitHub workflow only if a match is among the first 3,000 files; GitHub's docs don't say how `paths-ignore` treats such a diff.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#git-diff-comparisons",
    confidence: "High",
  },
  {
    id: "PA-6",
    text: "Path filters are not evaluated for pushes of tags; GitHub's docs don't say whether a push GitHub workflow with only `paths:` then runs or is skipped.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore",
    confidence: "Low",
  },
  {
    id: "PA-7",
    text: "Path patterns match the whole path from the repository root.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#patterns-to-match-file-paths",
    confidence: "High",
  },
  {
    id: "SK-1",
    text: "`[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]` or `[actions skip]` in the head commit's message, or a final `skip-checks: true` trailer after two empty lines, skips `push` and `pull_request` runs.",
    url: "https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs",
    confidence: "High",
  },
  {
    id: "PL-9",
    text: "GitHub doesn't start runs from a workflow file larger than 500 KB.",
    url: "https://docs.github.com/en/actions/reference/limits",
    confidence: "High",
  },
  {
    id: "DB-2",
    text: "A `push` runs the GitHub workflow as it is in the pushed commit.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push",
    confidence: "High",
  },
  {
    id: "DB-3",
    text: "A `pull_request` runs the GitHub workflow as it is in the pull request's merge commit.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request",
    confidence: "High",
  },
  {
    id: "PERM-1",
    text: "With no `permissions:` block, the `GITHUB_TOKEN` gets the token default: permissive is read and write on every scope, restricted is read on `contents` and `packages` only.",
    url: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#setting-the-permissions-of-the-github_token-for-your-repository",
    confidence: "High",
  },
  {
    id: "PERM-3",
    text: "In a `permissions:` block every scope it doesn't list is `none`; `read-all` and `write-all` set every scope, `{}` sets every scope to `none`, and `write` includes `read`.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions",
    confidence: "High",
  },
  {
    id: "PERM-4",
    text: "A job-level `permissions:` block replaces the workflow-level block for that job; the two don't merge.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idpermissions",
    confidence: "Med",
  },
  {
    id: "PERM-5",
    text: "`id-token` and `copilot-requests` take only `write` or `none`, and `vulnerability-alerts` only `read` or `none`; `read-all` and `write-all` give `vulnerability-alerts` `read`.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#defining-access-for-the-github_token-scopes",
    confidence: "High",
  },
  {
    id: "PERM-8",
    text: "GitHub's docs don't say what `id-token` and `copilot-requests`, which take only `write` or `none`, get when the token default or a fork or Dependabot run would give them another level.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#defining-access-for-the-github_token-scopes",
    confidence: "Low",
  },
  {
    id: "FK-0",
    text: "Same-repo runs get the full `secrets` context: repository secrets, the organization secrets the org's access policy and plan grant this repo, and environment secrets only in a job whose `environment` names that environment, once any required reviewers approve (PL-16). Which secrets exist is a repo fact the YAML can't show.",
    url: "https://docs.github.com/en/actions/concepts/security/secrets",
    confidence: "High",
  },
  {
    id: "PL-16",
    text: "Environment protection rules and branch policies can hold a job or keep an environment's secrets from it; WhyNoRun assumes they pass, and doesn't model environment secrets in reusable workflows (RU-3).",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments",
    confidence: "High",
  },
  {
    id: "JG-1",
    text: "A failed or skipped `needs` dependency skips the dependent job, down the whole chain, unless the dependent's `if:` has a status function that lets it run (`always()`, `failure()`, `cancelled()`, `!cancelled()`).",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds",
    confidence: "High",
  },
  {
    id: "JG-2",
    text: "An `if:` with no status function gets an implicit `success() &&`, so it is false when a `needs` dependency failed or was skipped.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions",
    confidence: "High",
  },
  {
    id: "JG-3",
    text: "A job's `if:` is evaluated before the job starts (and before any matrix expands); a false `if:` skips the whole job.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idif",
    confidence: "High",
  },
  {
    id: "JG-11",
    text: "Job-level `continue-on-error: true` keeps a failing job from failing the run, but GitHub's docs don't say whether its dependents see it as a success or a failure.",
    url: "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idcontinue-on-error",
    confidence: "Low",
  },
  {
    id: "WN-1",
    text: "Assumption: this job fails.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/6",
    confidence: "High",
  },
  {
    id: "WN-2",
    text: "Assumed to succeed: the job runs and WhyNoRun doesn't simulate its steps.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/6",
    confidence: "High",
  },
  {
    id: "WN-3",
    text: "Outside v1: WhyNoRun doesn't simulate this Event.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/6",
    confidence: "High",
  },
  {
    id: "WN-4",
    text: "Needs a run-time value the Scenario lacks, such as a step's output, which WhyNoRun never works out: supplying the value settles it, unless the value exists only at run time.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/8",
    confidence: "High",
  },
  {
    id: "WN-5",
    text: "Assumed default for an unset Scenario field: set it to confirm it or to try another value.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/8",
    confidence: "High",
  },
];

export const RULES: Readonly<Record<string, Rule>> = Object.fromEntries(
  rows.map((r) => [r.id, r]),
);
