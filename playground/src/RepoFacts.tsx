import { Fragment, type ReactNode } from "react";
import { withDefaults, type Scenario } from "../../src/core";
import type { Imported, ImportedFacts } from "./importRepo";

export type Source = "imported" | "assumed" | "set";

/** A source tag's text: an imported fact gets the import arrow (#9 §6). */
export const tagText = (source: Source) =>
  source === "imported" ? "⤓ imported" : source;

/** An imported tag's tooltip names the import. */
export const titleOf = ({ owner, repo, sha }: Imported) =>
  `${owner}/${repo} @ ${sha.slice(0, 7)}`;

export type Fact =
  "visibility" | "predates" | "defaultBranch" | "tokenDefault" | "eventPolicy";

// Each select option's text and the Scenario value it stands for.
const FACTS: {
  field: Fact;
  id: string;
  label: ReactNode;
  options?: [string, unknown][];
}[] = [
  {
    field: "visibility",
    id: "repo-visibility",
    label: "Visibility",
    options: ["public", "private", "internal"].map((v) => [v, v]),
  },
  {
    field: "predates",
    id: "repo-predates",
    label: "Created before 2026-09-17",
    options: [
      ["yes", true],
      ["no", false],
    ],
  },
  {
    field: "defaultBranch",
    id: "repo-default-branch",
    label: "Default branch",
  },
  {
    field: "tokenDefault",
    id: "repo-token-default",
    label: "Token default",
    options: ["restricted", "permissive"].map((v) => [v, v]),
  },
  {
    field: "eventPolicy",
    id: "repo-event-policy",
    label: (
      <>
        Event policy (<code>pull_request_target</code>)
      </>
    ),
    options: ["none", "allows", "blocks"].map((v) => [v, v]),
  },
];

/**
 * #9 §6: a Repo fact, or a fork contributor's Approval, is *assumed* while unset, so its
 * default applies, and set once changed. A fact still holding the import's value is imported.
 */
export function sourceOf(
  scenario: Scenario,
  path: string,
  imported?: ImportedFacts,
): Source | undefined {
  if (path === "event.approval")
    return Object.hasOwn(scenario.event, "approval") ? "set" : "assumed";
  const [group, field] = path.split(".");
  if (group !== "repo") return undefined;
  const set = Object.hasOwn(scenario.repo, field!);
  const key = field as keyof ImportedFacts;
  if (set && imported && Object.hasOwn(imported, key))
    if (scenario.repo[key] === imported[key]) return "imported";
  // owner/repo has no default: unset, it is simply not given.
  if (field === "repository") return set ? "set" : undefined;
  if (!FACTS.some((f) => f.field === field)) return undefined;
  return set ? "set" : "assumed";
}

/** The Repo facts fields after the simulation date, each with its source tag. */
export function RepoFacts({
  scenario,
  imported,
  onChange,
}: {
  scenario: Scenario;
  imported?: Imported;
  /** "" unsets the field, so its default applies again. */
  onChange: (field: Fact, value: unknown) => void;
}) {
  const values = withDefaults(scenario).scenario.repo;
  return FACTS.map(({ field, id, label, options }) => {
    const source = sourceOf(scenario, `repo.${field}`, imported?.facts)!;
    const common = {
      id,
      className: source,
      "aria-describedby": `${id}-source`,
    };
    return (
      <Fragment key={field}>
        <label htmlFor={id}>
          {label}{" "}
          {/* aria-hidden: the field reads it as its description, not in its name. */}
          <span
            id={`${id}-source`}
            className={`source-tag ${source}`}
            title={source === "imported" ? titleOf(imported!) : undefined}
            aria-hidden
          >
            {tagText(source)}
          </span>
        </label>
        {options ? (
          <select
            {...common}
            value={options.findIndex(([, v]) => v === values[field])}
            onChange={(e) => onChange(field, options[+e.target.value]![1])}
          >
            {options.map(([text], i) => (
              <option key={text} value={i}>
                {text}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            // Shown only while it's empty, so unset, when it's the default.
            placeholder={values.defaultBranch}
            value={scenario.repo.defaultBranch ?? ""}
            onChange={(e) => onChange(field, e.target.value)}
          />
        )}
      </Fragment>
    );
  });
}
