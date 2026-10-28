# Rulebook gaps found while modelling Verdicts

Research for wayfinder ticket #11 (map #1, WhyNoRun). Written 2026-10-28. It adds rows to the trigger rulebook from ticket #3 (`docs/research/2026-10-28-trigger-rules.md` on branch `research/trigger-rules`) for facts the Verdict model in #6 cites but the rulebook lacked.

## How to read this

- Rows use the rulebook's format (`| ID | Rule | Source | Conf. |`) and its confidence scale, so they can be appended to the matching section as they are.
- Rows marked **undocumented → model returns uncertain** have no primary source. The simulator must return `uncertain` for them and not guess.
- A row headed "(revised)" replaces the rulebook row with the same ID. IDs the model already cites are kept.
- **Sources.** docs.github.com pages were read on 2026-10-28 through the docs article API (`https://docs.github.com/api/article/body?pathname=…`). Line numbers (L…) refer to that rendered output. The docs source is `github/docs` at `3869faed24` (2026-10-27). Code: `actions/checkout` at `f548e57` (2026-07-20) and `actions/languageservices` at `4043eda` (2026-08-05).
- Short names (in addition to the rulebook's **WS**, **EV**, **TW**):
  - **WF** = <https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows>
  - **SECC** = <https://docs.github.com/en/actions/concepts/security/secrets>
  - **SECR** = <https://docs.github.com/en/actions/reference/security/secrets>
  - **SECU** = <https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets>
  - **CTX** = <https://docs.github.com/en/actions/reference/workflows-and-actions/contexts>
  - **RWH** = <https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows>
  - **RWR** = <https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations>
  - **TRR** = <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules>
  - **APB** = <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>
  - **CONC** = <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency>
  - **CANC** = <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation>
  - **TSW** = <https://docs.github.com/en/actions/how-tos/troubleshoot-workflows>
  - **CWE** = <https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution>
  - **AAP** = <https://docs.github.com/en/actions/concepts/about-actions-policies>

---

## Rows for §1 (Event matching)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| EV-0 | A run is created only for workflow files whose `on:` values match the triggering event. GitHub looks in `.github/workflows` at the event's commit SHA or ref, and "a workflow run is triggered for any workflows that have `on:` values that match the triggering event". An event not listed under `on:` creates no run, no jobs and therefore no check runs (so a required check it would have produced stays Pending, as in RQ-1). | WF L38–L44 (source: `github/docs` `data/reusables/actions/about-triggers.md`); WS §`on` L32 ("use `on` to define which events can cause the workflow to run") | High |

## Rows for §2 (Forks and secrets)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| FK-0 | **Same-repo runs** (a push to the repo, a PR from a branch in the same repo, any `pull_request_target` run) get the full `secrets` context: `GITHUB_TOKEN` (always present); repository secrets; organization secrets that the org's repository-access policy grants to this repo (all repos, private repos only, or a selected list; org secrets are not available to private repos on GitHub Free; only the first 100 alphabetically); and environment secrets only in a job that references that environment, read when that job starts and only after any required reviewers approve. On a name clash, environment beats repository, and repository beats organization. A secret reaches a step only if the workflow references it. The docs state this **by exclusion**: the only carve-outs are fork PRs (FK-2) and Dependabot (FK-8). There is no separate rule for org members versus other users with write access. Which secrets exist is a repo fact the YAML can't show. | SECC L9, L19–L21; SECR L15–L18, L24–L28, L34; SECU L83, L165–L167; CTX §`secrets` context L642–L646 | High |

## New §2.3 Reusable-workflow secrets

| ID | Rule | Source | Conf. |
|---|---|---|---|
| RU-1 | What a reusable (called) workflow sees in `secrets`: **(a) no `secrets:` on the caller job** → nothing except `GITHUB_TOKEN` ("Secrets are not automatically passed to reusable workflows"; the callee "is automatically granted access to `github.token` and `secrets.GITHUB_TOKEN`"). Any other `secrets.X` evaluates to an empty string with no error. **(b) Explicit mapping** → only the mapped names. Each key must be declared in the callee's `on.workflow_call.secrets`, and values may use the `github`, `needs` and `secrets` contexts. **(c) `secrets: inherit`** → "all the calling workflow's secrets … namely organization, repository, and environment secrets". The callee may reference them without declaring them. `inherit` works within one org, or across orgs in one enterprise, which always holds for a local callee. Secrets go only to the **directly** called workflow: in A > B > C, C gets only what B passes on. | SECU L166; RWR L106; CTX L29 (nonexistent property → empty string); WS §`jobs.<job_id>.secrets` L3221–L3225, §`jobs.<job_id>.secrets.inherit` L3237–L3239, §`jobs.<job_id>.secrets.<secret_id>` L3265–L3269; RWH L36–L39, L77, L240–L242 | High |
| RU-1a | The callee can only receive what the **caller run** has. A fork-PR caller passes nothing but `GITHUB_TOKEN` (FK-2), and a Dependabot caller passes Dependabot secrets (FK-8), whether through `inherit` or a mapping. The docs don't state this directly. It follows from RU-1 ("the calling workflow's secrets") together with FK-2 and FK-8. | inference from RU-1, FK-2, FK-8 | Med |
| RU-2 | Errors: a caller that passes a secret the callee doesn't declare "results in an error". A secret declared with `required: true` that the caller doesn't pass makes "the workflow run fail" (this checks only that a value is passed, not that the value is non-empty). ⚠️ The docs don't say whether these appear as a startup failure with no jobs, or as a validation error on the file. | WS §`on.workflow_call.secrets` L552, §`.required` L586–L588; RWH L61 | High (fails) / Low (form of failure) |
| RU-3 | **Environment secrets in a callee** (docs changed 2026-10-07): set `environment` on the callee's job, because the caller job can't use `environment`. The caller must **still pass** the secret, with `inherit` or by name, and can pass it by name even if it exists only in the environment. The environment value then wins over a repo or org secret of the same name. If the secret isn't passed, it resolves to an empty string with no error. Before 2026-10-07 the docs said the opposite: environment secrets "cannot be passed from the caller workflow". | RWH L54–L61; `github/docs` commit `8260600890` (2026-10-07, "Clarify how environment secrets work in reusable workflows", #63727) | High |

## Rows for §2.1 (`pull_request_target` and Actions policies)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| PRT-6 (revised) | **When no policy has an actor rule, nothing restricts actors.** "By default, every user with write access to a repository can trigger workflows", and Dependabot-triggered runs go ahead under FK-8. **When an applicable policy has an actor rule** (at any level, since policies layer), only the listed actors can run the targeted workflows. `dependabot[bot]` "must be added as an allowed actor" for user workflows it triggers, or its runs fail with a policy error (PRT-5). Dependabot's own built-in jobs on Actions are exempt. In Evaluate mode nothing is blocked. **The default `pull_request_target` policy is an event rule, not an actor rule.** It doesn't single out Dependabot, but once it is enforced, a Dependabot PR's `pull_request_target` run in a public repo is blocked like any other (PRT-2/3). ⚠️ The docs don't say in so many words that `dependabot[bot]`, which isn't a "user with write access", is allowed when no actor rule exists. That reading comes from the Dependabot pages, which describe its runs without any policy precondition. | CWE §"Restrict actors" L55–L61; AAP L20–L24, L34 ("Actor rules … including … Dependabot"); securely-using-pull_request_target §"Default policy" L47–L63; GA changelog <https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/> ("Actor rules cover the who, event rules cover the what"; the default is "a default rule that disables `pull_request_target`") | High (actor rule needs the allow-list) / Med (no-policy case) |

## Rows for §2.2 (`actions/checkout` refusal)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| CO-6 | **Step-level `continue-on-error: true` on a refused checkout step keeps the job from failing.** The refusal is a thrown error. `getInputs()` calls `assertSafePrCheckout` when the checkout isn't the default self-checkout, and `run()` catches the error and calls `core.setFailed`, so it is an ordinary step failure. Step `continue-on-error: true` "prevents a job from failing when a step fails": the step's `outcome` is `failure` and its `conclusion` is `success`, and later steps see `success()` as true. Those later steps run on a workspace with no checked-out PR code, so what they then do depends on the steps themselves. Side note: the default self-checkout (no `repository`/`ref` inputs) skips the guard entirely (`isDefaultCheckout`). | WS §`jobs.<job_id>.steps[*].continue-on-error` L2553–L2555; CTX `steps.<step_id>.outcome`/`.conclusion` L543–L544; `actions/checkout@f548e57` `src/input-helper.ts` L182–L200, `src/main.ts` L10–L30 | High |

## Rows for §4 (Concurrency)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| CC-11 | ⚠️ **Whether a cancelled run whose jobs keep running under CC-9 (`if: always()`) still holds its concurrency group is not documented.** CANC describes only how `if` is re-evaluated and how steps are stopped, and never mentions concurrency. The concurrency docs say only "at most one running job or workflow in a concurrency group". TSW L102–L106 describes such runs as remaining "in progress … continuing because of `always()`", which hints that they still occupy the group, and L108 says *stuck* runs keep blocking the group. Neither statement covers the survivor case. Also not stated: whether a cancellation caused by `cancel-in-progress` re-evaluates `if` the same way as a manual cancel (CC-9 assumes it does). | CANC L7–L11; WS §`concurrency` L923; CONC L11; TSW L102–L108 | undocumented → model returns uncertain |
| CC-12 | **A pair from different workflow files that share a group.** Groups are repository-wide "regardless of the workflow" (High). The docs attach `cancel-in-progress` to the item **being queued** ("When a concurrent job or workflow is queued … To also cancel any currently running job or workflow in the same concurrency group, specify `cancel-in-progress: true`"). The cross-workflow example shows the arriving workflow cancelling other workflows' runs. So **the arriving item's `cancel-in-progress` governs** whether the running item is cancelled, and the earlier item's own setting is never described as mattering. That isn't stated for mismatched settings, so it is Med. ⚠️ **Mixed `queue` modes** (A has `single`, B has `max`, or the reverse) are undocumented. The docs describe `queue` as a property of "the concurrency group" but declare it per item. Return uncertain. ⚠️ CONC/WS "Example: Concurrency groups" (CONC L64, WS L976) says a new run "will cancel any workflow or job already running" without mentioning `cancel-in-progress`, but its examples set `cancel-in-progress: true`. Follow CC-1/CC-2. | WS §`concurrency` L923–L932, L976, L1049; CONC L11–L20, L64, L137; `github/docs` commit `336b7f546d` (2026-05-06, queue docs) | Med (cancel-in-progress: arriving item's) / undocumented → model returns uncertain (mixed `queue`) |

## Rows for §5 (Required checks)

| ID | Rule | Source | Conf. |
|---|---|---|---|
| RQ-0 | **Required-check name of a workflow job is `<job name>`.** The workflow name and event aren't part of it: "Required status checks do not take workflow, matrix, or event trigger types into account." The job name is `jobs.<id>.name` if it is set and non-empty, otherwise the job id. The official parser's `jobName()` returns the job key for a missing or empty `name`; the docs only say `name` is "displayed in the GitHub UI". `name:` may hold expressions with the `github`, `needs`, `strategy`, `matrix`, `vars` and `inputs` contexts. The check name is the evaluated string, so a name built from a value the Scenario lacks is WN-4. Job names should be unique across workflows, because a duplicate name gives "ambiguous status check results". ⚠️ **Whether required-check name matching is case-sensitive is undocumented.** Treat an exact match as a match and a case-only match as uncertain. | TRR §"Troubleshooting required status checks" L19–L27; WS §`jobs.<job_id>.name` L1137; CTX availability table L77; APB tip L7; `actions/languageservices@4043eda` `workflow-parser/src/model/converter/job.ts` L147, L164, L181–L191 | High (format) / Med (id fallback: parser, not docs) / undocumented → model returns uncertain (case) |
| RQ-9 (revised) | A **reusable** job's required-check name is `<job name> / <reusable job name>` (caller job name, then callee job name, each per RQ-0). This is now documented. ⚠️ **Matrix** job check names (such as `job (os, node)`) are still not specified, and "do not take … matrix … into account" doesn't say how legs are named. Keep matrix-derived names Low. | TRR L23–L27 | High (reusable) / Low (matrix) |

---

## Does the model's planned value hold? (against the #6 resolution)

| Gap | Planned in #6 | Finding |
|---|---|---|
| EV-0 | GitHub workflow `skipped` (no run) when the event isn't under `on:` | **Holds.** |
| FK-0 | Secrets `available` for same-repo and `pull_request_target` runs | **Holds.** Mention in the Explanation that environment secrets also need the job's `environment` and approval (PL-16), and that org secrets depend on the access policy and plan. |
| RU-1 | Callee with no `secrets:` → `empty` | **Holds, with two gaps.** `empty` still includes `GITHUB_TOKEN`. A `required: true` secret that isn't passed makes the run **fail** (RU-2), and passing an undeclared secret is an error, so the model needs a `fails`/Diagnostic path. `inherit` → caller's value (`available` or `dependabot-only`); explicit mapping → only mapped names. |
| RQ-0 | Check name = `name:` or job id; Pending when no job derives the name | **Holds** for format. Required-check names exclude workflow name and event. Case-insensitive matching is undocumented → uncertain. **Contradiction (RQ-9):** #6 makes a badge Uncertain when the name matches only through a derived `caller / callee` name. That format is now documented (TRR), so only matrix-derived names should stay Uncertain. |
| CO-6 | Job `fails` on checkout refusal (CO-1) | **Contradiction when the step has `continue-on-error: true`.** The job does not fail. The model must check step-level `continue-on-error` before giving `fails`: the result is `runs` (WN-2), with the refusal in the Explanation. |
| CC-11 | `uncertain` | **Holds.** Undocumented. |
| Cross-file pairs (CC-12) | Arriving run's settings govern (Med); mixed `queue` modes → `uncertain` | **Holds.** `cancel-in-progress` from the arriving item, Med. Mixed `queue` stays uncertain. |
| PRT-6 for Dependabot | No actor-policy input; Dependabot runs under FK-8 | **Holds** for "no policy → Dependabot runs" (Med, WN-5 default). If an actor-policy fact is ever added, Dependabot without an allow-list → `fails` (PRT-5). Dependabot `pull_request_target` in a public repo follows the PRT decision table like any actor. |

## 2026 changes touching these rows

- **2026-10-07:** environment secrets in reusable workflows were reversed in the docs. The caller must now pass them (RU-3); before, the docs said they couldn't be passed.
- **2026-09-17:** workflow execution protections GA, with the explicit `dependabot[bot]` allow-list requirement (PRT-6). The enforcement date of the default `pull_request_target` policy is 2026-12-02 (PRT-3).
- **2026-07-20 / 06-18:** the `actions/checkout` refusal that CO-6 builds on (CO-1, CO-3).
- **2026-05-16:** the cancellation reference was reworded (`github/docs` `ecb3e3d95e`). It still says nothing about concurrency (CC-11).
- **2026-05-06:** the concurrency `queue` property was documented (`336b7f546d`). Its docs leave the mixed-mode case open (CC-12).

## Verdict for the map

All 8 gaps now have rows. EV-0, FK-0, RU-1, CO-6 and RQ-0's format are High. CC-12's cancel rule and PRT-6's no-policy case are Med. CC-11, mixed `queue` modes, required-check case sensitivity and matrix check names are undocumented → `uncertain`. The research found three places where #6's model needs a change:

1. CO-6: step-level `continue-on-error: true` turns a CO-1 `fails` into `runs`.
2. RU-2: a missing `required: true` secret fails the callee run.
3. RQ-9: `caller / callee` check names are documented, so they shouldn't force an Uncertain badge.
