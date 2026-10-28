import type { ReactNode } from "react";
import type { Verdict } from "../../src/core";

const TONES: Record<string, string> = {
  runs: "good",
  passes: "good",
  fails: "bad",
  cancelled: "bad",
  "fails and blocks merge": "bad",
  pending: "wait",
  "pending and blocks merge": "wait",
  "may not block": "wait",
  uncertain: "uncertain",
};

export function Value({ verdict }: { verdict: Verdict }) {
  return (
    <span className="value" data-tone={TONES[verdict.value] ?? "neutral"}>
      {verdict.value}
      {verdict.possible && ` (${verdict.possible.join(", ")})`}
    </span>
  );
}

const possibleKey = (v: Verdict) =>
  JSON.stringify([...(v.possible ?? [])].sort());

/** Same `value` and `possible` (unordered); a Verdict missing on one side differs (#12 addendum C). */
export const same = (a?: Verdict, b?: Verdict) =>
  a === b ||
  (!!a && !!b && a.value === b.value && possibleKey(a) === possibleKey(b));

/** One Scenario's column. */
export interface Column {
  label: string;
  /** Undefined while the Scenario has no simulation date. */
  verdicts?: Verdict[];
  /** Why the column is blocked, as a sentence ending ("has no simulation date"). */
  blocked?: string;
  /** The date prompt or Unsupported panel a blocked column's header carries. */
  header?: ReactNode;
}

// #9 §1: the groups within each file, in order. `event` stands alone, before every file.
const GROUPS = ["Event", "Runs", "Access", "Required checks", "Concurrency"];

function groupOf(key: string): string {
  const parts = key.split(" › ");
  const last = parts.at(-1)!;
  if (key === "event") return "Event";
  if (parts[0] === "check") return "Required checks";
  if (last.startsWith("concurrency")) return "Concurrency";
  if (last.startsWith("token.") || last === "secrets") return "Access";
  return "Runs";
}

/** The All Verdicts grid: subject keys by Scenario, ◆ on differences (#9 §1, #12 §7, addenda C, F). */
export function Grid({
  columns,
  files,
  diagnosed,
  diffOnly,
  setDiffOnly,
  open,
  onOpen,
}: {
  columns: Column[];
  /** The Workflow set's file names, sorted. */
  files: string[];
  /** The names of files with Diagnostics. */
  diagnosed: Set<string>;
  diffOnly: boolean;
  setDiffOnly: (on: boolean) => void;
  open?: { key: string; i: number };
  onOpen: (key: string, i: number) => void;
}) {
  const find = (c: Column, key: string) =>
    c.verdicts?.find((v) => v.key === key);
  const blocked = columns.filter((c) => c.blocked);
  const differs = (key: string) =>
    blocked.length === 0 &&
    columns.some((c) => !same(find(c, key), find(columns[0]!, key)));
  const keys = [
    ...new Set(columns.flatMap((c) => c.verdicts?.map((v) => v.key) ?? [])),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const named = new Set(files);
  const sections = [
    { file: "", keys: keys.filter((k) => !named.has(k.split(" › ")[0]!)) },
    ...files.map((file) => ({
      file,
      keys: keys.filter((k) => k.split(" › ")[0] === file),
    })),
  ];

  const span = columns.length + 2;
  const rows: ReactNode[] = [];
  for (const { file, keys } of sections) {
    if (diagnosed.has(file)) {
      if (!diffOnly)
        rows.push(
          <tr key={file} className="diagnosed">
            <td />
            <th scope="row" className="key">
              {file}
            </th>
            <td colSpan={columns.length}>file has Diagnostics</td>
          </tr>,
        );
      continue;
    }
    for (const group of GROUPS) {
      const shown = keys.filter(
        (k) => groupOf(k) === group && (!diffOnly || differs(k)),
      );
      if (shown.length === 0) continue;
      rows.push(
        <tr key={`${file}:${group}`} className="group">
          <th colSpan={span} scope="rowgroup">
            {file ? `${file} · ${group}` : group}
          </th>
        </tr>,
      );
      for (const key of shown) {
        const d = differs(key);
        rows.push(
          <tr key={key} className={d ? "differs" : undefined}>
            <td className="gutter">
              {d && (
                <>
                  ◆<span className="visually-hidden"> differs</span>
                </>
              )}
            </td>
            <th scope="row" className="key">
              {key}
            </th>
            {columns.map((c, i) => {
              const v = find(c, key);
              return (
                <td key={i}>
                  <span className="tag">{c.label}</span>
                  {v ? (
                    <button
                      type="button"
                      className="verdict"
                      data-key={key}
                      data-scenario={i}
                      aria-expanded={open?.key === key && open.i === i}
                      onClick={() => onOpen(key, i)}
                    >
                      <Value verdict={v} />
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              );
            })}
          </tr>,
        );
      }
    }
  }

  const filter = (
    <label className="row">
      <input
        type="checkbox"
        checked={diffOnly}
        onChange={(e) => setDiffOnly(e.target.checked)}
      />
      ◆ Differences only
    </label>
  );

  // Addendum C: no difference is computed against a blocked column.
  if (diffOnly && blocked.length > 0)
    return (
      <>
        {filter}
        <p>
          {blocked.map((c) => `${c.label} ${c.blocked}`).join(", and ")}, so
          differences can&rsquo;t be shown.
        </p>
      </>
    );
  if (diffOnly && rows.length === 0)
    return (
      <>
        {filter}
        <p>
          No differences: both Scenarios give the same Verdicts.{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setDiffOnly(false);
            }}
          >
            Show every Verdict
          </a>
        </p>
      </>
    );
  return (
    <>
      {filter}
      <div className="grid-box">
        <table className="grid">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Subject key</th>
              {columns.map((c, i) => (
                <th key={i} scope="col">
                  {c.label}
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </>
  );
}
