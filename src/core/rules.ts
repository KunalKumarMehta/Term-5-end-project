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
    id: "WN-3",
    text: "Outside v1: WhyNoRun doesn't simulate this Event.",
    url: "https://github.com/KunalKumarMehta/whynorun/issues/6",
    confidence: "High",
  },
];

export const RULES: Readonly<Record<string, Rule>> = Object.fromEntries(
  rows.map((r) => [r.id, r]),
);
