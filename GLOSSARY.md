# WhyNoRun

WhyNoRun predicts what GitHub Actions will do for an event the user describes, and explains each outcome by pointing at the workflow YAML that causes it.

## Language

**Maintainer**:
The person who edits a repository's workflow files and owns its branch protection. WhyNoRun's primary user, usually on a public repo that accepts pull requests from forks.
_Avoid_: user, admin, DevOps engineer

**GitHub workflow**:
A GitHub Actions workflow file under `.github/workflows/`. Jobs and steps keep GitHub's meanings.
_Avoid_: workflow (on its own), pipeline, action

**Workflow set**:
The GitHub workflow files WhyNoRun simulates against, all from one repository at one point in time.
_Avoid_: repo, files, project

**Core flow**:
One of the few complete user → action → result paths through WhyNoRun that the product is built around.
_Avoid_: workflow, feature, use case

## Scenario

**Scenario**:
Everything WhyNoRun is told about one situation: an Event, an optional Follow-up event, the Repo facts and any Assumptions.
_Avoid_: case, input, config

**Event**:
The GitHub event the Maintainer describes: its name and activity type, the Actor kind, the ref and base branch, the changed files, the head commit message, whether a fork contributor's run is approved, and any other event payload values the Maintainer supplies.
_Avoid_: trigger, webhook

**Follow-up event**:
A second Event that arrives while the first Event's run is still in progress or pending, used to predict concurrency outcomes.
_Avoid_: event B, second trigger

**Actor kind**:
Who caused the Event, as GitHub distinguishes them: a member, a fork contributor or `dependabot[bot]`.
_Avoid_: user type, fork flag

**Repo facts**:
What determines an outcome but isn't in the YAML, such as visibility, the token default, the event policy, branch protection, repository variables and the simulation date.
_Avoid_: settings, options, environment

**Assumption**:
A run-time outcome the Maintainer stipulates because no YAML can know it, such as "job X fails" or the value of a job's output.
_Avoid_: override, mock

## Outcomes

**Verdict**:
WhyNoRun's predicted outcome for one subject (a GitHub workflow, a job, one token scope, a job's secrets, a required check, or a run in a concurrency pair), with its Explanation.
_Avoid_: result, report, prediction

**Explanation**:
The ordered chain of causes behind a Verdict. Each cause names one rule, the YAML it rests on and the Scenario inputs it used.
_Avoid_: reason, trace, log

**Root cause**:
The first cause in an Explanation: the reason a Verdict has its value, such as the path filter that skipped a GitHub workflow.
_Avoid_: skip reason, primary cause

**Uncertain**:
A Verdict that can't be settled, either because GitHub's documentation leaves the case open or because it depends on a run-time value the Scenario doesn't hold. It names why, which Scenario inputs would settle it (none, when GitHub leaves the case open or the value exists only at run time), and, when there are only a few, the possible outcomes, never ranked.
_Avoid_: unknown, maybe, guess

**Unsupported**:
A Verdict for something outside what WhyNoRun simulates, such as an event it doesn't cover.
_Avoid_: unknown, error

**Platform baseline**:
The fixed list of platform conditions WhyNoRun always takes as given, such as Actions being enabled and no billing stop, stated once rather than as causes on each Verdict.
_Avoid_: standing assumptions, defaults, Assumption

**Diagnostic**:
A problem in a GitHub workflow file that stops WhyNoRun reading it or GitHub accepting it, reported at its position instead of Verdicts.
_Avoid_: error, warning, lint

**Merge-readiness badge**:
The Verdict for one required check: Passes, May not block, Uncertain, Pending and blocks merge, or Fails and blocks merge.
_Avoid_: check status, check result

**Behaviour test**:
A Scenario plus the Verdicts the Maintainer pinned as expected, checked again whenever the Workflow set changes.
_Avoid_: snapshot, golden file, assertion

**Test file**:
A file committed to the Maintainer's repository holding one or more Behaviour tests, each named by a label unique in the file.
_Avoid_: suite, spec, snapshot
