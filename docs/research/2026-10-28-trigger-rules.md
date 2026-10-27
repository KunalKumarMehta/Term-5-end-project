# GitHub Actions rules for triggers, forks, permissions, concurrency and required checks

Research for wayfinder ticket #3 (map #1, WhyNoRun). Written 2026-10-28.

## How to read this

- Each rule has an ID (`EV-3`, `PERM-2`, …) so the simulation spec (#5, #6, #8) can cite it.
- **Confidence:** **High** means a primary source states the rule outright. **Med** means it is inferred from documented rules or worded loosely. **Low/Unverified** means no primary source settles it, so the simulator should say "uncertain" rather than guess.
- ⚠️ marks an ambiguity or a gap in the docs.
- **Sources.** docs.github.com pages were read on 2026-10-28 through the docs article API (`https://docs.github.com/api/article/body?pathname=…`). That API returns the rendered page, with all reusables filled in. The docs source is `github/docs` at commit `4e811c0` (2026-10-27). Code citations: `actions/languageservices` at `4043eda` (2026-08-05) and `actions/checkout` at `f548e57` (2026-07-20). Changelog posts are cited by URL.
- Short names used below:
  - **WS** = <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
  - **EV** = <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
  - **TW** = <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow>

---

## 1. Event matching (does a workflow file get a run for this event?)

### 1.1 Activity types

| ID | Rule | Source | Conf. |
|---|---|---|---|
| EV-1 | `pull_request` and `pull_request_target` with no `types:` run only for `opened`, `synchronize` and `reopened`. Any other activity, such as `labeled`, `edited`, `closed` or `ready_for_review`, needs an explicit `types:` entry. | EV §`pull_request` note 1, §`pull_request_target` note | High |
| EV-2 | For every other multi-type event (e.g. `issues`, `label`, `check_run`, `workflow_run`, `branch_protection_rule`), "By default, all activity types trigger workflows". | EV, each event's note (e.g. §`branch_protection_rule`, §`workflow_run`) | High |
| EV-3 | One activity that matches several entries gives one run per matching event. For example, an issue opened with two labels gives 3 runs for `types: [opened, labeled]`. Simultaneous events give separate runs. | WS §`on` → "Using activity types", "Using multiple events" | High |
| EV-4 | The parser accepts a `stacked` activity type for `pull_request` and `pull_request_target`, but the docs don't list it. ⚠️ Treat it as valid syntax with undocumented semantics. | `actions/languageservices` `workflow-parser/src/workflow-v1.0.json` L897, L1050, compared with the EV tables | Med |

### 1.2 Branch and tag filters

| ID | Rule | Source | Conf. |
|---|---|---|---|
| BR-1 | `branches` and `branches-ignore` can't both appear on the same event. Neither can `tags` and `tags-ignore`. To include and exclude in one list, use `branches`/`tags` with `!` patterns. A list that has `!` patterns also needs at least one positive pattern. | WS §`on.push.<branches\|tags\|…>`; TW "Including and excluding branches" | High |
| BR-2 | For `pull_request` and `pull_request_target`, `branches` matches the **base (target) branch** of the PR. | WS §`on.<pull_request\|pull_request_target>.<branches…>` ("pull requests that target specific branches") | High |
| BR-3 | For `push`, the filters match the pushed ref's name. If only `branches*` is defined, tag pushes don't run, and if only `tags*` is defined, branch pushes don't run. If neither is defined, both run. | WS §`on.push.<branches\|tags…>` | High |
| BR-4 | Patterns are tried in order, and the last match wins. A `!` pattern after a positive match excludes the ref, and a positive pattern after a negative one includes it again. | TW "Including and excluding branches" | High |
| BR-5 | `branches-ignore`/`tags-ignore` skips the workflow when **any** pattern matches the ref. | TW "Excluding branches" | High |
| BR-6 | Defining both a branch filter and a path filter means **both** must pass (AND). | WS §`on.push…`, §`on.<pull_request…>` | High |
| BR-7 | `workflow_run.branches` matches the branch the *triggering* workflow ran on. | EV §`workflow_run` → "Limiting your workflow to run based on branches" | High |
| BR-8 | ⚠️ The docs say patterns are "evaluated against the Git ref's name" and show short names (`main` ↔ `refs/heads/main`). They don't say whether a fully qualified `refs/heads/main` pattern also matches. Match short names and flag full-ref patterns as "may not match". | TW "Including branches" | Low |
| BR-9 | `pull_request_target`: "branches with names that match certain patterns (such as those which look similar to SHAs) may not trigger" the workflow. The patterns aren't published. ⚠️ | EV §`pull_request_target` | Med (rule exists, details unknown) |

### 1.3 Path filters

| ID | Rule | Source | Conf. |
|---|---|---|---|
| PA-1 | Path filters exist for `push`, `pull_request` and `pull_request_target`. `paths` and `paths-ignore` can't both appear on one event. | WS §`on.<push\|pull_request\|pull_request_target>.<paths\|paths-ignore>` | High |
| PA-2 | `paths`: the workflow runs if **at least one** changed file matches, after `!` processing in order with the last match winning. `paths-ignore`: the workflow is skipped only if **all** changed files match. | TW "Including paths", "Excluding paths"; WS note on ordering | High |
| PA-3 | If no files changed, the workflow doesn't run. | WS §"Git diff comparisons" | High |
| PA-4 | **Changed files come from different diffs per event.** A PR uses a three-dot diff: the head against the merge base with the base branch, so it covers the whole PR, not just the newest commits. A push to an existing branch uses a two-dot diff of `before..after`. A push of a new branch uses a two-dot diff "against the parent of the ancestor of the deepest commit pushed". ⚠️ That last phrase is vague. A simulator needs the user to supply the file list for new-branch pushes. | WS §"Git diff comparisons" | High (PR, existing branch) / Low (new branch) |
| PA-5 | **Limits:** a push of more than 1,000 commits always runs. A diff that times out always runs. A diff of more than **3,000** files does *not* run unless a match is among the first 3,000 files. ⚠️ The ticket says "300": that is the older limit, and GHES before 3.22 still uses it. github.com uses 3,000. | WS §"Git diff comparisons"; `github/docs` `data/features/actions-paths-filter-limit.yml` (fpt `*`, ghes `>=3.22`) and `data/reusables/actions/workflows/triggering-a-workflow-paths5.md` L12 | High |
| PA-6 | "Path filters are not evaluated for pushes of tags." ⚠️ The docs don't say whether a `push` workflow with only `paths:` then *runs* or *is skipped* on a tag push. Combined with BR-3 (no branch or tag filter means it runs for tags), the most likely reading is that it **runs**. Unverified. | WS §`on.<push…>.<paths…>` | Low |
| PA-7 | Paths are matched against the whole path from the repository root. | WS §"Patterns to match file paths" | High |

### 1.4 Glob dialect (applies to branch, tag, path and `workflow_run` workflow-name filters)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| GL-1 | `*` matches zero or more characters except `/`. `**` matches zero or more of any character, including `/`. | WS §"Filter pattern cheat sheet" | High |
| GL-2 | **`?` means "zero or one of the *preceding* character", and `+` means "one or more of the preceding character".** These follow regex rules, not shell rules: `'*.jsx?'` matches `page.js` and `page.jsx`. ⚠️ Off-the-shelf minimatch, picomatch and micromatch treat `?` as "any single character", so WhyNoRun needs its own matcher. | WS §"Filter pattern cheat sheet" (bullets and the `'*.jsx?'` row) | High |
| GL-3 | `[]` matches one alphanumeric character from a set or range. Ranges are only `a-z`, `A-Z` and `0-9`. | same | High |
| GL-4 | `!` only has meaning as the first character of a pattern. Escape special characters with `\` for a literal match. | same; WS §`on.push…` ("escape each of these special characters with `\`") | High |
| GL-5 | A pattern that starts with `*`, `[` or `!` must be quoted in YAML. Unquoted, it is a parse error and the workflow doesn't run. | same | High |
| GL-6 | ⚠️ The docs don't say whether matching is case-sensitive, or how `**` behaves in the middle of a branch name. The cheat-sheet examples are the only spec. Build golden tests from those rows. | — | Low |

### 1.5 Which events need the workflow on the default branch, and which ref and SHA run

| ID | Rule | Source | Conf. |
|---|---|---|---|
| DB-1 | These events trigger only if the workflow file exists **on the default branch**: `schedule`, `workflow_dispatch`, `workflow_run`, `delete`, `check_run`, `check_suite`, `branch_protection_rule` and others with the same note. Their `GITHUB_REF` is the default branch. | EV, each event's table and note | High |
| DB-2 | `push` runs workflows "not merged into the default branch". The workflow file comes from the pushed commit (`GITHUB_SHA` is the pushed tip). | EV §`push` | High |
| DB-3 | `pull_request` runs the workflow file from the PR **merge commit** (`refs/pull/N/merge`). A fork PR can therefore change the workflow that runs, which is why the fork restrictions in §2 exist. | EV §`pull_request` → "How the merge branch affects your workflow"; <https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target> §"Risks" | High |
| DB-4 | `pull_request_target` **always** runs the workflow file and the default checkout from the **default branch**, whatever the PR's base branch, with `GITHUB_REF` set to the default branch. This has applied since 2025-12-08. | EV §`pull_request_target` table; <https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/> | High |
| DB-5 | A `pull_request` doesn't run while the PR has a merge conflict. `pull_request_target` still runs. | EV §`pull_request` note 2 | High |
| DB-6 | `workflow_dispatch`: the "Run workflow" button appears only if the file is on the default branch. After one run, the API or CLI can dispatch it on any branch or tag. | EV §`workflow_dispatch` | High |

### 1.6 Commit-message skips

| ID | Rule | Source | Conf. |
|---|---|---|---|
| SK-1 | `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a final `skip-checks: true` trailer (after two blank lines), skips **`push` and `pull_request` only**. For `push` it reads the commit message; for a PR, the HEAD commit's message. `pull_request_target` is **not** skipped. | <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs> | High |
| SK-2 | ⚠️ "Commit message in a push" doesn't say which commit counts in a multi-commit push. A reasonable guess is the head commit. | same | Low |

### 1.7 Recursion: events caused by `GITHUB_TOKEN`

| ID | Rule | Source | Conf. |
|---|---|---|---|
| RC-1 | Events caused by `GITHUB_TOKEN` create **no** runs. The exceptions are `workflow_dispatch` and `repository_dispatch` (always run), and `pull_request` `opened`/`synchronize`/`reopened` from a PR the token created or updated. Those create runs in an **approval-required** state that a write user must approve. Other PR activity types create nothing. A PAT or GitHub App token avoids this restriction. | <https://docs.github.com/en/actions/concepts/security/github_token> §"When GITHUB_TOKEN triggers workflow runs"; TW §"Triggering a workflow from a workflow"; EV §`pull_request` note 4 | High |
| RC-2 | `workflow_run` chains stop after three levels: in A→B→C→D→E→F, E and F don't run. | EV §`workflow_run` | High |
| RC-3 | `check_run` and `check_suite` don't trigger when the check suite was created by Actions. | EV §`check_run` | High |

---

## 2. Forks

| ID | Rule | Source | Conf. |
|---|---|---|---|
| FK-1 | For a fork PR, the base repo receives `pull_request`, `pull_request_target`, `pull_request_review`, `pull_request_review_comment` and `issue_comment`. **No** PR events occur in the fork. | EV §`pull_request` → "Pull request events for forked repositories" | High |
| FK-2 | Fork PR under `pull_request`: "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner", and the `GITHUB_TOKEN` is **read-only**. Every `write` is downgraded to `read` (PERM-4). | EV §"Workflows in forked repositories"; `github/docs` `data/reusables/actions/forked-secrets.md`; WS §"How permissions are calculated" | High |
| FK-3 | **Private repos only:** the settings "Run workflows from fork pull requests", "Send write tokens…", "Send secrets…" and "Require approval…" change FK-2. An org that disables one blocks the repo from enabling it. Fork PRs to private repos run only when the first setting is on. | <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository> §"Enabling workflows for forks of private repositories" | High |
| FK-4 | **Approval (public repos):** by default, first-time contributors need a write user to approve before workflows run. The policies are: first-time contributors new to GitHub, first-time contributors (any merged commit or PR exempts the user), or all external contributors (not a repo or org member). Both the PR author and the event actor are checked. A repo setting overrides the org or enterprise setting. | same page §"Controlling changes from forks to workflows in public repositories" | High |
| FK-5 | Runs awaiting approval for more than 30 days expire and are marked **failed**. | <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks> | High |
| FK-6 | `pull_request_target` runs "regardless of approval settings", because it runs base-branch code. | managing-github-actions-settings page §"Controlling changes from forks…" | High |
| FK-7 | `pull_request_target` gets a **read/write** `GITHUB_TOKEN` (subject to `permissions:`) and **secrets**, even from a public fork. | WS §`permissions`; securely-using-pull_request_target §"Risks" | High |
| FK-8 | Dependabot PRs are treated as fork PRs: read-only token, no secrets. | WS §"Permissions for workflow runs triggered by Dependabot"; EV fork note | High |
| FK-9 | Workflows don't run *in* a fork until Actions is enabled in the fork's Actions tab. Scheduled workflows in a fork of a public repo are disabled by default. | EV §"Workflows in forked repositories"; <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows> | High |
| FK-10 | The `pull_request` webhook payload is empty for merged PRs and for PRs from forks. ⚠️ This is a webhook detail, not an Actions `github.event` detail. Don't model it as an empty `github.event`. | EV §`pull_request` note 3 | Med |
| FK-11 | Cache: `pull_request_target`, `issue_comment` and fork-PR `workflow_run` cascades, running in the default-branch-SHA context, get **read-only** cache tokens. A save logs a warning and the job continues. `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, `pull_request` and `release` keep read-write. A `cache-mode:` key can opt back in. | <https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/>; securely-using-pull_request_target §"Hardening"; WS §`cache-mode` | High |

### 2.1 `pull_request_target` default policy (the 2 Dec 2026 change)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| PRT-1 | **Workflow execution protections** are GA as of 2026-09-17. Repo, org and enterprise **Actions policies** have actor rules (who may trigger) and event rules (which events may trigger), and can target specific workflow files. Policies layer like rulesets. Modes are **Evaluate** (log only, GHEC) or **Active**. | <https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/>; <https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution>; <https://docs.github.com/en/actions/concepts/about-actions-policies> | High |
| PRT-2 | A **default policy blocks `pull_request_target` in public repos** that have no applicable Actions event policy. It doesn't apply to private or internal repos, and it doesn't override an event policy that already exists. Until enforcement it runs in **evaluate** mode, so runs continue. | <https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target> §"Default policy for pull_request_target" | High |
| PRT-3 | **The enforcement date is 2 December 2026.** ⚠️ The GA changelog (2026-09-17) says "**November 2**, 2026". The docs were changed to December 2 on 2026-10-23 in `github/docs` commit `e8090f5f83`, "Push PR target policy to December 2 (#64377)", which edited `data/reusables/actions/workflows/pull-request-target-policy.md`. The changelog post wasn't updated. **Use 2 Dec 2026**, and note in the UI that the date has already moved once. | docs as above; changelog as above; `gh api repos/github/docs/commits?path=data/reusables/actions/workflows/pull-request-target-policy.md` | High (date) |
| PRT-4 | Enforcement covers "affected repositories that were using the default `pull_request_target` policy **before general availability**". ⚠️ The docs don't say whether a public repo created after 2026-09-17 gets the default policy in Active mode straight away or in Evaluate mode. | securely-using-pull_request_target §"Default policy" | Low |
| PRT-5 | A blocked run **fails with an error**, e.g. `Event 'workflow_dispatch' is not allowed to trigger Actions workflows. Workflow file: '…'`. It is a visible failed run, not a silent skip. ⚠️ The docs don't say what conclusion its check gets (`failure` or `startup_failure`), so they don't say how a required check sees it. | about-actions-policies §"About workflow execution protections" | High (fails) / Low (check conclusion) |
| PRT-6 | Default actor rule: "every user with write access to a repository can trigger workflows". Actor rules can narrow that. GitHub's own features are exempt for built-in processes, but `dependabot[bot]` must be allow-listed for user workflows it triggers. | control-workflow-execution §"Restrict actors" | High |
| PRT-7 | The **Require lockfile** protection blocks runs whose `uses:` dependencies aren't pinned in a workflow dependency lockfile. The lockfiles feature has been in public preview since 2026-10-14. | control-workflow-execution §"Require lockfile" | High (exists) / Med (preview) |

### 2.2 `actions/checkout` refusal (June 2026)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| CO-1 | `actions/checkout` v7 (GA 2026-06-18) **throws** when the event is `pull_request_target`, or `workflow_run` whose `workflow_run.event` starts with `pull_request`, **and** the PR head repo id ≠ the base repo id (a fork), **and** any of these holds: `repository` equals the PR head repo full name (case-insensitive); `ref` matches `^refs/pull/[0-9]+/(head\|merge)$`; or the resolved commit equals the PR head SHA or `merge_commit_sha`. For `workflow_run` it compares `head_commit.id`, and also `head_sha` unless the upstream event was `pull_request_target`. | `actions/checkout` `src/unsafe-pr-checkout-helper.ts` L4, L13–L82; changelog <https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/> | High |
| CO-2 | Opt-out: `allow-unsafe-pr-checkout: true` (default `false`). | `actions/checkout` `action.yml` L101–L109; `src/input-helper.ts` L183–L186 | High |
| CO-3 | Backport: every supported major except v1 got the check on **2026-07-20** (moved from 07-16), so floating tags such as `@v4` are covered. Workflows pinned to a SHA, minor or patch version aren't covered. | changelog above (editor's note, 2026-07-15) | High |
| CO-4 | Same-repo PRs and the `pull_request` event are unaffected. `git fetch`, `gh pr checkout`, downloaded artifacts and other events such as `issue_comment` aren't covered. | changelog; securely-using-pull_request_target §"Opting out" | High |
| CO-5 | ⚠️ WhyNoRun can only *flag* CO-1 statically. Whether the resolved ref equals the PR SHA depends on runtime values. Literal expressions such as `${{ github.event.pull_request.head.sha }}` are decidable. | inference | Med |

---

## 3. `GITHUB_TOKEN` permissions

| ID | Rule | Source | Conf. |
|---|---|---|---|
| PERM-1 | **Baseline:** the enterprise, org or repo default is either **permissive** (read/write on all scopes) or **restricted** (read on `contents` and `packages` only). Personal-account repos default to restricted. Org repos inherit from the org. If an org or enterprise picks restricted, the repo can't pick permissive. Orgs and enterprises created after 2023-02-02 default to read-only. Older ones keep whatever they had. | managing-github-actions-settings §"Setting the permissions of the GITHUB_TOKEN"; <https://github.blog/changelog/2023-02-02-github-actions-updating-the-default-github_token-permissions-to-read-only/> | High |
| PERM-2 | **Resolution order:** baseline → workflow-level `permissions:` → job-level `permissions:` → for fork PRs (any PR event except `pull_request_target`, without "Send write tokens"), every `write` becomes `read`. | WS §"How permissions are calculated for a workflow job" | High |
| PERM-3 | In any `permissions:` mapping, **unlisted scopes become `none`**. `read-all`/`write-all` set every scope. `{}` sets all to none. `write` includes `read`. | WS §`permissions`, §`jobs.<job_id>.permissions` | High |
| PERM-4 | A job-level block **replaces** the workflow-level block for that job; the two don't merge. ⚠️ The docs say "adjusted… first at the workflow level and then at the job level". Together with PERM-3, that means a job block is a full specification. Medium confidence. | WS §"How permissions are calculated" + PERM-3 | Med |
| PERM-5 | Scopes and allowed levels as of today: `actions`, `artifact-metadata`, `attestations`, `checks`, `code-quality`, `contents`, `deployments`, `discussions`, `issues`, `packages`, `pages`, `pull-requests`, `security-events` and `statuses` take read/write/none. `copilot-requests` and `id-token` take write/none only. `vulnerability-alerts` takes read/none, and `read-all`/`write-all` give it `read`. | WS §"Defining access for the GITHUB_TOKEN scopes" | High |
| PERM-6 | Fork PRs can add or remove **read** but "typically" can't get `write`. The exception is "Send write tokens to workflows from pull requests" (private repos). | WS §"Changing the permissions in a forked repository" | High |
| PERM-7 | Reusable workflows: if the caller job sets no `permissions`, the called workflow gets the **default** token permissions. Called and nested workflows can only keep or **reduce** permissions; in A > B > C, B and C can't exceed A. | <https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations> L70–L71, L91 (rendered) | High |
| PERM-8 | ⚠️ The old docs table "Default access (permissive / restricted) / Maximum access for fork PRs", per scope, is gone from current docs. `github/docs` has no "Maximum access" text. Per-scope fork maximums such as `id-token` aren't documented any more. Model the fork maximum as "every write → read" and flag `id-token` on fork PRs as uncertain. | grep of `github/docs@4e811c0` content/data | Low |
| PERM-9 | ⚠️ The `metadata: read` scope that is always granted isn't in the current permissions list. The simulator shouldn't show it as configurable. | WS table | Low |
| PERM-10 | The repo setting "Allow GitHub Actions to create and approve pull requests" is off by default for personal repos. It limits what the token can do, whatever `permissions:` says. | managing-github-actions-settings §"Preventing GitHub Actions from creating or approving pull requests" | High |
| PERM-11 | `@actions/workflow-parser` **validates** `permissions` but **drops** it from the `WorkflowTemplate` model. `WorkflowTemplate` and `BaseJob` have no permissions field. WhyNoRun must read the raw YAML token itself. | `actions/languageservices` `workflow-parser/src/model/workflow-template.ts` L10–L60; schema `workflow-v1.0.json` L1580–L1620 | High |

---

## 4. Concurrency

| ID | Rule | Source | Conf. |
|---|---|---|---|
| CC-1 | At most **one running** and, by default, **one pending** job or run per group, **across the whole repository and every workflow**. When a new item arrives, any existing *pending* item in the group is **cancelled** and replaced, even without `cancel-in-progress`. | WS §`concurrency`; §"Only cancel in-progress jobs or runs for the current workflow" ("regardless of the workflow") | High |
| CC-2 | `cancel-in-progress: true` also cancels the *running* item. It may be an expression. | WS §`concurrency` | High |
| CC-3 | **New `queue` property:** `single` (default) behaves as CC-1. `max` allows up to **100** pending items, FIFO by the time each started waiting; once full, more are cancelled or rejected. `queue: max` together with `cancel-in-progress: true` is a **validation error**. | WS §`concurrency`, §"Queueing multiple pending runs"; <https://docs.github.com/en/actions/reference/limits> "Concurrency group queue"; parser `workflow-v1.0.json` L2059–L2088, `converter/concurrency.ts` L22–L31 | High |
| CC-4 | Group names are **case-insensitive** (`prod` = `Prod`). | WS §`concurrency` note | High |
| CC-5 | The workflow-level group may use `github`, `inputs` and `vars`. The job-level group may also use `needs`, `strategy` and `matrix`. An undefined property, such as `github.head_ref` on push, resolves to empty, so a fallback (`|| github.run_id`) is needed to keep groups apart. | WS §`concurrency`, §`jobs.<job_id>.concurrency`, "Using a fallback value"; contexts availability table | High |
| CC-6 | FIFO order "is not guaranteed", because start times vary. ⚠️ The simulator should present ordering as likely, not certain. | WS §`concurrency` note | High (that it's unspecified) |
| CC-7 | A called (reusable) workflow sees the *caller's* `github.workflow`. The same group in caller and callee with `cancel-in-progress: true` cancels itself. | reusing-workflow-configurations L72 | High |
| CC-8 | A check waiting at the front of the queue on a full concurrency group shows status `pending`. | <https://docs.github.com/en/pull-requests/reference/status-checks> §"Check statuses and conclusions" | High |
| CC-9 | On cancellation, the server re-evaluates job `if:` conditions. Jobs whose `if` is still true, e.g. `always()`, keep running. No `if` is treated as `success()`. | <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation> | High |

---

## 5. Required checks

| ID | Rule | Source | Conf. |
|---|---|---|---|
| RQ-1 | **A workflow skipped by a path filter, a branch filter or a commit-message skip creates no check runs. Its required checks stay "Pending" (the `expected` state, "Waiting for status to be reported") and block the merge.** | <https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks> §"Handling skipped but required checks"; TW "Including paths"; skip-workflow-runs note; status-checks table (`expected`) | High |
| RQ-2 | **A job skipped by its own `if:` reports "Success"** and doesn't block, even when required. | status-checks note; troubleshooting table | High |
| RQ-3 | A job skipped because a `needs` dependency failed "may not block merging". The fix is `if: always()` (or `!cancelled()`) on required aggregator jobs. | troubleshooting table | High |
| RQ-4 | Passing conclusions are `success`, `skipped` and `neutral`. A required check must pass **on the latest head SHA**, or on the test merge commit if that commit has statuses, and must have succeeded in the repo within the past 7 days. If a check and a commit status share a name, both must pass. | troubleshooting §"Required check needs to succeed…", §"Conflicts…"; <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches> §"Require status checks before merging" | High |
| RQ-5 | Checks from workflow jobs count for a PR only when the run was triggered by `push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment` or `deployment_status`. A `workflow_dispatch` run on the head branch **never** satisfies a required check. | troubleshooting §"Checks from some workflow jobs are not evaluated" | High |
| RQ-6 | Merge queues need a `merge_group` trigger, or the required check is never reported and the merge fails. | troubleshooting §"Status checks with GitHub Actions and a Merge queue" | High |
| RQ-7 | A required check can be bound to a specific App source. A status set by anyone else blocks the merge. | about-protected-branches; troubleshooting §"Required status checks from unexpected sources" | High |
| RQ-8 | **Documented workarounds:** (a) "Avoid requiring workflows that can be skipped." In practice, make the workflow always trigger and move the condition into a job-level `if:` (RQ-2). (b) Use `always()` with `needs` on gating jobs (RQ-3). (c) Add `merge_group` (RQ-6). (d) For commit-message skips, push a new commit without the skip text. ⚠️ The older docs pattern of a same-named "dummy" workflow with opposite path filters isn't in current docs. Present it as folklore, if at all. | troubleshooting table; skip-workflow-runs | High (a–d) |
| RQ-9 | ⚠️ How the check name of a matrix or reusable job is formed (`job (os, node)`, `caller / callee`) isn't specified in these pages. That matters when matching a required check name to a job. The simulator should compute candidate names and label them as derived. | — | Low |

---

## 6. Job graph

| ID | Rule | Source | Conf. |
|---|---|---|---|
| JG-1 | `needs` takes a string or a list. A failed or skipped dependency skips the dependent job, and the skip **propagates down the whole chain**, unless the dependent's `if` contains a status function that lets it run (`always()`, `failure()`, `cancelled()`, `!cancelled()`). | WS §`jobs.<job_id>.needs` | High |
| JG-2 | An `if` with no status function gets an implicit `success() && (…)`. An empty `if` means `success()`. The parser makes this explicit. | <https://docs.github.com/en/actions/reference/workflows-and-actions/expressions> §"Status check functions"; `actions/languageservices` `workflow-parser/src/model/converter/if-condition.ts` L21–L43, L79–L84 | High |
| JG-3 | `jobs.<id>.if` is evaluated **before** the matrix is expanded. `matrix` isn't available, and neither is `secrets`; allowed contexts are `github`, `needs`, `vars` and `inputs`. A false `if` skips the whole matrix job as one unit. | WS §`jobs.<job_id>.if` note; contexts availability table | High |
| JG-4 | An `if` beginning with `!` must be wrapped in `${{ }}` or quoted, because otherwise it is a YAML tag. | WS §`jobs.<job_id>.if` | High |
| JG-5 | **Matrix expansion:** take the Cartesian product of the dimensions in definition order. Remove `exclude` entries, where a partial match is enough. Then apply each `include` in order. An include entry merges into every *original* combination it doesn't overwrite; values added by an earlier include may be overwritten. If it merges into none, it becomes a new combination. With only `include`, each entry is its own job. Variable names are case-insensitive. | WS §`strategy.matrix`, `.include`, `.exclude`; <https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations> §"Expanding or adding matrix configurations" (worked example) | High |
| JG-6 | A matrix is capped at **256** jobs per run. | WS §`strategy.matrix`; limits | High |
| JG-7 | `fail-fast` defaults to `true`: one failing leg cancels in-progress and queued legs, unless that leg has `continue-on-error: true`. | WS §`strategy.fail-fast` | High |
| JG-8 | Matrix values built from `fromJSON(needs.x.outputs…)` are only known at runtime. `strategy` allows `github`, `needs`, `vars` and `inputs`. ⚠️ WhyNoRun must show these as "dynamic" and let the user supply values. | contexts table; run-job-variations §"Using an output to define two matrices" | High |
| JG-9 | `@actions/workflow-parser` keeps `strategy` as a raw `TemplateToken` and does **not** expand matrices. Expansion is done server-side in closed code. WhyNoRun must implement JG-5 itself and test it against the docs examples. | `workflow-parser/src/model/workflow-template.ts` L46; `converter/job.ts` L118–L119 | High |
| JG-10 | Reusable workflows nest up to 10 levels deep, with at most 50 unique reusable workflows per run tree. | reusing-workflow-configurations L36–L38 | High |

---

## 7. Platform-only causes (state the YAML can't show)

Each of these needs a scenario input in WhyNoRun, because nothing in the YAML reveals it.

| ID | Cause | Effect | Source |
|---|---|---|---|
| PL-1 | Actions disabled for the repo, org or enterprise, or a GitHub-controlled disabled state | No workflows run | managing-github-actions-settings §"About…", §"Managing…" (notes) |
| PL-2 | Workflow disabled manually | No triggers. Existing runs continue but can't be re-run. | disable-and-enable-workflows |
| PL-3 | Scheduled workflows auto-disabled after **60 days without repository activity** (public repos), and disabled by default in forks of public repos. ⚠️ "Activity" isn't defined. A commit that changes the `cron` line re-enables the workflow and makes the committer the actor. | No scheduled runs | EV §`schedule` notes, §"actor for scheduled workflows"; disable-and-enable-workflows |
| PL-4 | `schedule` delayed under load, especially at the top of the hour. "Some queued jobs may be dropped." Minimum interval is 5 minutes. The `timezone` key and DST rules apply. | Late or missing scheduled run | EV §`schedule`; WS §`on.schedule` |
| PL-5 | Fork-PR approval pending (FK-4) or expired after 30 days (FK-5) | "Awaiting approval", then failed | FK-4, FK-5 |
| PL-6 | `GITHUB_TOKEN`-caused events (RC-1) | No run, or an approval-required run | RC-1 |
| PL-7 | Event not created: more than 3 tags pushed at once (`push`, `create`, `delete`), or more than 5,000 branches pushed at once | No run | EV §`push`, §`create`, §`delete` notes |
| PL-8 | Rate limits: 1,500 trigger events per 10 s per repo, and 500 queued runs per 10 s (beyond that, runs "will not be queued") | Dropped runs | limits |
| PL-9 | Workflow file larger than 500 KB | "Will not start runs" | limits §"Workflow file size" |
| PL-10 | Execution-protection actor or event rules, including the default `pull_request_target` block from 2 Dec 2026 (PRT-2/3), and Require lockfile (PRT-7) | Run fails with a policy error | §2.1 |
| PL-11 | Allowed-actions policy, "Require actions to be pinned to a full-length commit SHA", or a reusable workflow the caller can't access | Run fails at startup (nested-access failure is documented; the exact conclusion isn't) ⚠️ | managing-github-actions-settings §"Allowing select actions…"; reusing-workflow-configurations L89 |
| PL-12 | Merge conflict on the PR | No `pull_request` run (DB-5) | EV |
| PL-13 | Private repo fork-PR policies off (FK-3) | No run, or no secrets or write token | FK-3 |
| PL-14 | Org or enterprise token default forced to restricted (PERM-1), or "create and approve PRs" off (PERM-10) | Token narrower than the YAML suggests | PERM-1, PERM-10 |
| PL-15 | Self-hosted job queued for more than 24 h; run longer than 35 days; job longer than 6 h on hosted runners | Cancelled or failed | limits |
| PL-16 | Environment protection rules and branch policies. For PR events, branch policies evaluate against `refs/pull/N/merge` (`pull_request`) or the default branch (`pull_request_target`). | Job `waiting`, or blocked from secrets | 2025-11-07 changelog; status-checks (`waiting`) |

---

## 8. What `@actions/workflow-parser` gives WhyNoRun and what it doesn't

Checked in `actions/languageservices@4043eda`. This decides how much of §1–§6 WhyNoRun has to write itself.

- **It gives** normalised `on:` with filter lists (`converter/events.ts` L76–L84), concurrency `{group, cancelInProgress, queue}` (`converter/concurrency.ts`), `if` with the implicit `success()` (`converter/if-condition.ts`), `needs`, cron validation, and schema errors. Errors include unknown keys and the `queue` values `single`/`max`.
- **It doesn't give** filter *matching* (no glob engine), permissions (dropped from the model), matrix expansion, fork, approval and policy logic, or required-check evaluation. ⚠️ The parser doesn't appear to enforce "`branches` and `branches-ignore` together is an error" (no code found). WhyNoRun should add that check itself.
- Implementation detail: none of the decision logic is in `actions/runner`. The runner receives jobs that are already matched, expanded and permissioned. Everything in §1–§6 runs inside GitHub's closed-source service, so the docs, plus behaviour seen on github.com, are the only spec.

---

## Verdict for the map

**Question:** what are GitHub's documented rules, and the known undocumented behaviour, for the decisions WhyNoRun must simulate?

1. **The rules are well documented and can be simulated deterministically** for the core path: activity-type defaults (EV-1/2), branch, tag and path filters with last-match-wins `!` (BR-*, PA-*), the AND of the two filter kinds, skip messages, `GITHUB_TOKEN` recursion, fork token, secrets and approval, permission resolution, concurrency, and required-check outcomes. Building WhyNoRun from this rulebook is feasible. Most rules here are High confidence. The exceptions are the ⚠️ rows listed in point 6.
2. **WhyNoRun must write its own engines** for glob matching, permission resolution and matrix expansion. The official parser doesn't do them (PERM-11, JG-9, §8). The glob dialect is not shell glob: `?` and `+` act on the *preceding character* (GL-2). Using minimatch or picomatch would give wrong answers. The docs cheat-sheet rows make a ready golden-test suite.
3. **The demo story is confirmed.** The `pull_request_target` default block is enforced on **2 December 2026** for public repos without an event policy (PRT-2/3). The GA changelog still says 2 November; the docs moved it on 2026-10-23. The `actions/checkout` refusal has applied since 2026-06-18 (v7) and 2026-07-20 (backports), with exact conditions in source (CO-1). WhyNoRun can predict, from YAML plus a "repo is public / has event policy?" input, that a `pull_request_target` workflow will **fail with a policy error** after 2 Dec, and that a checkout of `head.sha` from a fork **will throw**.
4. **The required-check trap is documented, not folklore.** A filter- or message-skipped workflow leaves its required checks "Pending" and blocks the merge. An `if:`-skipped job reports Success. Checks from `workflow_dispatch` never count. Merge queues need `merge_group`. The official fix is "don't require skippable workflows; move the condition into a job `if:`". WhyNoRun can explain this and suggest that fix.
5. **Scenario inputs WhyNoRun needs** (state the YAML can't show; §7): visibility (public or private), whether the PR comes from a fork, the contributor's approval status, the org/repo token default, the private-fork settings, execution policies, whether Actions or the workflow is disabled, the schedule-inactivity state, and the changed-file list for new-branch pushes.
6. **Flag these as uncertain rather than guess:** whether a paths-only push workflow runs on a tag push (PA-6), the diff base for a new-branch push (PA-4), full-ref branch patterns (BR-8), glob case sensitivity (GL-6), per-scope fork maximums such as `id-token` (PERM-8), the check conclusion of a policy-blocked run (PRT-5), the default-policy mode for repos created after GA (PRT-4), the definition of schedule "activity" (PL-3), check naming for matrix and reusable jobs (RQ-9), and concurrency FIFO order (CC-6).
7. **Corrections to the ticket's wording:** the diff limit is **3,000** files on github.com (300 only on GHES before 3.22). Concurrency now has a `queue: max` mode (up to 100 pending), so "pending-run replacement" is only the default (`queue: single`).

For tickets #5, #6 and #8: build the simulator as rule modules keyed by these IDs, with every explanation citing an ID. Any decision that touches a ⚠️ rule returns "uncertain" with the reason, not a guess.
