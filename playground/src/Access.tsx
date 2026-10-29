import { useState } from "react";
import { isAccess, type Verdict } from "../../src/core";
import { Value, same, type Column } from "./Grid";
import { PinToggle } from "./Pins";

export { isAccess };

/** The Access tab (#9 §1): one card per job with access keys, each Scenario a column. */
export function Access({
  columns,
  open,
  onOpen,
  noVerdicts,
}: {
  columns: Column[];
  open?: { key: string; i: number };
  onOpen: (key: string, i: number) => void;
  /** Why a Scenario has no Verdicts at all. */
  noVerdicts: string;
}) {
  const live = columns.filter((c) => !c.blocked && c.verdicts);
  const jobs = [
    ...new Set(
      live.flatMap((c) =>
        c.verdicts!.flatMap((v) =>
          v.key.endsWith(" › secrets") ? [v.key.slice(0, -10)] : [],
        ),
      ),
    ),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const blocked = columns.flatMap((c) =>
    c.blocked ? [<div key={c.label}>{c.header}</div>] : [],
  );

  // #12 addendum F: an empty tab says why, and what would fill it.
  if (jobs.length === 0)
    return (
      <>
        {blocked}
        {live.length > 0 && (
          <p>
            {live.every((c) => c.verdicts!.length === 0)
              ? noVerdicts
              : "No job here runs steps, so none gets a token or secrets. A job with steps: would get a card here."}
          </p>
        )}
      </>
    );
  return (
    <>
      {blocked}
      {jobs.map((job) => (
        <Card
          key={job}
          job={job}
          columns={columns}
          open={open}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

function Card({
  job,
  columns,
  open,
  onOpen,
}: {
  job: string;
  columns: Column[];
  open?: { key: string; i: number };
  onOpen: (key: string, i: number) => void;
}) {
  const [all, setAll] = useState(false);
  const compare = columns.length > 1;
  const find = (c: Column, key: string) =>
    c.verdicts?.find((v) => v.key === key);
  // In key order, which puts secrets first; the card lists it after the scopes.
  const keys = [
    ...new Set(
      columns.flatMap(
        (c) =>
          c.verdicts?.flatMap((v) =>
            v.key.startsWith(`${job} › `) && isAccess(v.key) ? [v.key] : [],
          ) ?? [],
      ),
    ),
  ];
  const secrets = `${job} › secrets`;
  const subjects = [...keys.filter((k) => k !== secrets), secrets];
  // Display only: every scope key still exists (ADR 0001).
  const none = subjects.filter((key) =>
    columns.every((c) => (find(c, key)?.value ?? "none") === "none"),
  );
  const shown = all ? subjects : subjects.filter((k) => !none.includes(k));
  const differs = (key: string) =>
    compare &&
    columns.every((c) => !c.blocked) &&
    columns.some((c) => !same(find(c, key), find(columns[0]!, key)));

  const button = (v: Verdict, i: number) => (
    <>
      <button
        type="button"
        className="verdict"
        data-key={v.key}
        data-scenario={i}
        aria-expanded={open?.key === v.key && open.i === i}
        onClick={() => onOpen(v.key, i)}
      >
        <Value verdict={v} />
      </button>
      <PinToggle i={i} subject={v.key} />
    </>
  );

  return (
    <section className="card" aria-label={job}>
      <h3>
        <span className="key">{job}</span>{" "}
        {columns.map((c, i) => {
          const run = find(c, job);
          return (
            run && (
              <span key={i} className="run">
                {compare && <span className="tag">{c.label} </span>}
                {button(run, i)}{" "}
              </span>
            )
          );
        })}
        <span className="hint">Access computed as if the job runs</span>
      </h3>
      <table className="grid">
        {compare && (
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Subject</th>
              {columns.map((c, i) => (
                <th key={i} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {shown.map((key) => {
            const d = differs(key);
            return (
              <tr key={key} className={d ? "differs" : undefined}>
                <td className="gutter">
                  {d && (
                    <>
                      ◆<span className="visually-hidden"> differs</span>
                    </>
                  )}
                </td>
                <th scope="row" className="key">
                  {key.slice(job.length + 3).replace(/^token\./, "")}
                </th>
                {columns.map((c, i) => {
                  const v = find(c, key);
                  return (
                    <td key={i}>
                      {compare && <span className="tag">{c.label}</span>}
                      {v ? button(v, i) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {none.length > 0 && (
            <tr>
              <td className="gutter" />
              <td colSpan={columns.length + 1} className="hint">
                {all
                  ? `${none.length} scopes at none shown`
                  : `${none.length} other scopes: none`}{" "}
                <button type="button" onClick={() => setAll(!all)}>
                  {all ? "hide" : "show"}
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
