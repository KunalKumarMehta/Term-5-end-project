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
];

export const RULES: Readonly<Record<string, Rule>> = Object.fromEntries(
  rows.map((r) => [r.id, r]),
);
