import { Fragment } from "react";
import { isConcurrency, type Verdict } from "../../src/core";
import { Value, same, type Column } from "./Grid";

const ADD = "Add a Follow-up event to see what happens to run B";

/**
 * The Concurrency tab (#9 §1): for each `concurrency:` declared, run A's value and resolved
 * group beside the group as written, "while A is in progress/pending…", then run B's.
 */
export function Concurrency({
  columns,
  states,
  open,
  onOpen,
  onAddFollowUp,
}: {
  columns: Column[];
  /** Each Scenario's run A state when B arrives; undefined with no Follow-up event. */
  states: (string | undefined)[];
  open?: { key: string; i: number };
  onOpen: (key: string, i: number) => void;
  onAddFollowUp: (i: number) => void;
}) {
  const compare = columns.length > 1;
  const find = (c: Column, key: string) =>
    c.verdicts?.find((v) => v.key === key);
  const keys = new Set(
    columns.flatMap(
      (c) =>
        c.verdicts?.flatMap((v) => (isConcurrency(v.key) ? [v.key] : [])) ?? [],
    ),
  );
  // Each declaration's subject: its file or job key.
  const subjects = [...keys]
    .map((k) => k.slice(0, -" › concurrency.A".length))
    .filter((s, i, all) => all.indexOf(s) === i)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const differs = (key: string) =>
    compare &&
    columns.every((c) => !c.blocked) &&
    columns.some((c) => !same(find(c, key), find(columns[0]!, key)));
  // #12 addendum F: the Scenarios with Verdicts but no Follow-up event.
  const lacking = columns.flatMap((c, i) =>
    !c.blocked && c.verdicts && states[i] === undefined ? [i] : [],
  );

  const cell = (v: Verdict, i: number) => (
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
      </button>{" "}
      <span className="resolved">
        group {v.group === undefined ? "unknown" : <code>{v.group}</code>}
        {v.key.endsWith(".A") && (
          <>
            {" "}
            from <code>{v.groupSource}</code>
          </>
        )}
      </span>
    </>
  );
  const run = (key: string) => {
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
          {key}
        </th>
        {columns.map((c, i) => {
          const v = find(c, key);
          return (
            <td key={i}>
              {compare && <span className="tag">{c.label}</span>}
              {v ? cell(v, i) : "—"}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <>
      {columns.flatMap((c) =>
        c.blocked ? [<div key={c.label}>{c.header}</div>] : [],
      )}
      {subjects.length === 0 ? (
        <p>
          No GitHub workflow or job here declares <code>concurrency:</code>, so
          no run waits for or cancels another.
        </p>
      ) : (
        <table className="grid concurrency">
          {compare && (
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Run</th>
                {columns.map((c, i) => (
                  <th key={i} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {subjects.map((s) => {
              const b = `${s} › concurrency.B`;
              return (
                <Fragment key={s}>
                  {run(`${s} › concurrency.A`)}
                  {keys.has(b) && (
                    <>
                      <tr className="while">
                        <td className="gutter" />
                        <td />
                        {states.map((state, i) => (
                          <td key={i}>
                            {state &&
                              `while A is ${state === "pending" ? "pending" : "in progress"}…`}
                          </td>
                        ))}
                      </tr>
                      {run(b)}
                    </>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      {subjects.length > 0 &&
        lacking.map((i) => (
          <p key={i}>
            {compare && <>{columns[i]!.label}: </>}
            <a
              href="#follow-up-add"
              onClick={(e) => {
                e.preventDefault();
                onAddFollowUp(i);
              }}
            >
              {ADD}
            </a>
          </p>
        ))}
    </>
  );
}
