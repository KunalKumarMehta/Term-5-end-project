import { useEffect, useId, useState, type ReactNode } from "react";
import type { Verdict } from "../../src/core";
import { Value, same, type Column } from "./Grid";

/**
 * #9 §4: a Scenario's required checks as chips (Enter adds, × removes) and strict or loose.
 * Typed names are trimmed, an empty one adds nothing, and a duplicate (an exact match, case
 * included) flashes its chip and is announced (#12 §1, addenda E and I).
 */
export function RequiredChecks({
  required,
  strict,
  onChange,
  announce,
}: {
  required: string[];
  strict: boolean;
  onChange: (path: "required" | "strict", value: string[] | boolean) => void;
  announce: (message: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  // The duplicate's chip, and a count that tells one flash from the next.
  const [flash, setFlash] = useState<{ name: string; n: number }>();
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(undefined), 1000);
    return () => clearTimeout(timer);
  }, [flash]);

  const add = () => {
    const name = text.trim();
    setText("");
    if (name === "") return;
    if (required.includes(name)) {
      setFlash({ name, n: (flash?.n ?? 0) + 1 });
      announce(`${name} is already required`);
      return;
    }
    onChange("required", [...required, name]);
  };

  return (
    <div className="required-checks">
      <span className="label" id={`${id}-label`}>
        Required checks
      </span>
      <ul className="chips" aria-labelledby={`${id}-label`}>
        {required.map((name) => (
          <li
            // A new key remounts the chip, so a second flash restarts.
            key={flash?.name === name ? `${name} ${flash.n}` : name}
            className={flash?.name === name ? "chip flash" : "chip"}
          >
            <code>{name}</code>
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() =>
                onChange(
                  "required",
                  required.filter((n) => n !== name),
                )
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor={`${id}-add`}>Add a required check</label>
      <input
        id={`${id}-add`}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          add();
        }}
      />
      <label htmlFor={`${id}-mode`}>Mode</label>
      <select
        id={`${id}-mode`}
        value={strict ? "strict" : "loose"}
        onChange={(e) => onChange("strict", e.target.value === "strict")}
      >
        <option value="loose">loose</option>
        <option value="strict">strict (up to date before merging)</option>
      </select>
    </div>
  );
}

const isCheck = (key: string) => key.startsWith("check › ");

/** The Merge readiness tab (#9 §1): one row per `check › <name>`, each Scenario a column. */
export function MergeReadiness({
  columns,
  control,
  open,
  onOpen,
}: {
  columns: Column[];
  /** The form Scenario's required-checks control, at the top of the tab. */
  control: ReactNode;
  open?: { key: string; i: number };
  onOpen: (key: string, i: number) => void;
}) {
  const compare = columns.length > 1;
  const find = (c: Column, key: string) =>
    c.verdicts?.find((v) => v.key === key);
  const keys = [
    ...new Set(
      columns.flatMap(
        (c) =>
          c.verdicts?.flatMap((v) => (isCheck(v.key) ? [v.key] : [])) ?? [],
      ),
    ),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const differs = (key: string) =>
    compare &&
    columns.every((c) => !c.blocked) &&
    columns.some((c) => !same(find(c, key), find(columns[0]!, key)));

  const button = (v: Verdict, i: number) => (
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
  );

  return (
    <>
      {control}
      {columns.flatMap((c) =>
        c.blocked ? [<div key={c.label}>{c.header}</div>] : [],
      )}
      {keys.length === 0 ? (
        // #12 addendum F.
        <p>
          No required checks yet, so no check can block merge. Add names above.
        </p>
      ) : (
        <table className="grid">
          {compare && (
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Required check</th>
                {columns.map((c, i) => (
                  <th key={i} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {keys.map((key) => {
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
                        {v ? button(v, i) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
