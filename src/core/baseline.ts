/**
 * The Platform baseline (#8 §1): "What WhyNoRun always assumes". Taken as given and never
 * shown as a cause. The playground footer, the CLI header and the README render this list.
 */
export const PLATFORM_BASELINE: readonly string[] = [
  "Actions are enabled for the repo, org and enterprise, and the GitHub workflow isn't disabled (PL-1, PL-2).",
  "The event was created: no more than 3 tags or 5,000 branches pushed at once (PL-7), and no trigger or queue rate limit is hit (PL-8).",
  "The event wasn't caused by `GITHUB_TOKEN` (PL-6).",
  "No execution-protection actor rule, no event rule other than the `pull_request_target` event policy, and no Require-lockfile policy (PL-10, PRT-6, PRT-7).",
  "The allowed-actions and SHA-pinning policies permit every `uses:` (PL-11).",
  "The pull request has no merge conflict (PL-12, DB-5).",
  "Environment protection rules and branch policies pass (PL-16).",
  '"Allow GitHub Actions to create and approve pull requests" is on (PERM-10).',
  "No runner-queue, run or job time limit is hit (PL-15), and there is no billing or storage stop (PL-17).",
];
