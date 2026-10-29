import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  shown,
  writeTestFile,
  type Change,
  type Finding,
  type Scenario,
  type TestFile,
} from "../../src/core";

/** Pins by Scenario: a pin is one (Scenario, subject key) pair (#9 §3). */
export const Pins = createContext<
  | {
      pinned: (i: number, key: string) => boolean;
      toggle: (i: number, key: string) => void;
      /** What `whynorun test` would report for a loaded pin (#12 §9). */
      status: (i: number, key: string) => Finding | undefined;
    }
  | undefined
>(undefined);

/** A pinned field as `pinned → now`: `—` is absent, and a pinned null "must be absent" (#12 §9). */
const changeText = (c: Change) =>
  `${c.field} ${c.pinned === null ? "must be absent" : shown(c.pinned)} → ${shown(c.now)}`;

/** A loaded pin's status mark beside its toggle: ✓ or changed (#12 §9). */
function PinMark({ finding }: { finding: Finding }) {
  if (finding.status === "match")
    return (
      <span className="pin-status">
        ✓<span className="visually-hidden"> matches its pin</span>
      </span>
    );
  if (finding.status !== "changed") return null;
  return (
    <span className="pin-status changed">
      changed {finding.changes.map(changeText).join("; ")}
    </span>
  );
}

/** The pin icon beside a Verdict row; its pressed state is the feedback (#12 §1, addendum E). */
export function PinToggle({ i, subject }: { i: number; subject: string }) {
  const pins = useContext(Pins);
  if (!pins) return null;
  const finding = pins.status(i, subject);
  return (
    <>
      <button
        type="button"
        className="pin"
        aria-pressed={pins.pinned(i, subject)}
        aria-label={`Pin ${subject}`}
        onClick={() => pins.toggle(i, subject)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path d="M5 1h6v1l-1 1v4l2 2v1H8.5v5h-1v-5H4V9l2-2V3L5 2z" />
        </svg>
      </button>
      {finding && <PinMark finding={finding} />}
    </>
  );
}

/** An opened test's statuses that have no Verdict row to sit on (#12 §9, addendum G). */
export interface TestStatus {
  label: string;
  /** "waiting for a Workflow set", or for the simulation date. */
  waiting?: string;
  findings: Finding[];
  /** Whether a candidate subject already has a pin in this Scenario. */
  pinned: (key: string) => boolean;
  repoint: (from: string, to: string) => void;
  remove: (key: string) => void;
}

/** The opened Test file's statuses, once per test: waiting, pins not found, Diagnostics, unsupported. */
export function OpenedTest({
  name,
  tests,
}: {
  name: string;
  tests: TestStatus[];
}) {
  return (
    <section className="opened-test" aria-label="Opened Test file">
      <p>
        Test file <code>{name}</code>
      </p>
      <ul>
        {tests.flatMap((t) => [
          ...(t.waiting
            ? [
                <li key={`${t.label}:waiting`}>
                  {t.label}: pins {t.waiting}
                </li>,
              ]
            : []),
          ...t.findings.map((f) => {
            if (f.status === "file has Diagnostics")
              return (
                <li key={`${t.label}:${f.file}`} className="error">
                  {t.label}: <code>{f.file}</code> file has Diagnostics
                </li>
              );
            if (f.status === "Scenario unsupported")
              return (
                <li
                  key={`${t.label}:unsupported`}
                  id={`unsupported:${t.label}`}
                  tabIndex={-1}
                  className="error"
                >
                  {t.label}: Scenario unsupported (root WN-3): {f.reason}
                </li>
              );
            if (f.status !== "pinned subject not found") return null;
            return (
              <li
                key={`${t.label}:${f.key}`}
                id={`not-found:${t.label}:${f.key}`}
                tabIndex={-1}
                className="error"
              >
                {t.label}: <code>{f.key}</code> pin not found
                {f.candidates.length > 0 && <> · re-point to </>}
                {f.candidates.map((c) => (
                  // Re-pointing never overwrites or merges (addendum G).
                  <button
                    key={c}
                    type="button"
                    disabled={t.pinned(c)}
                    onClick={() => t.repoint(f.key, c)}
                  >
                    {c}
                    {t.pinned(c) && " (already pinned)"}
                  </button>
                ))}{" "}
                <button type="button" onClick={() => t.remove(f.key)}>
                  Remove pin
                </button>
              </li>
            );
          }),
        ])}
      </ul>
    </section>
  );
}

/**
 * #10 §1: `<event>-<actor kind>` while the label is still a default "Scenario N", otherwise
 * the label's slug: lowercase `[a-z0-9-]`, other runs as `-`, ends trimmed, else `behaviour`.
 */
export function defaultTestPath(label: string, scenario: Scenario): string {
  const name = /^Scenario \d+$/.test(label)
    ? `${scenario.event.name}-${scenario.event.actor ?? "member"}`
    : label
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "behaviour";
  return `.github/whynorun/${name}.test.yml`;
}

type Tests = Parameters<typeof writeTestFile>[0];

/**
 * The tray's Save dialog: an editable path, a preview, then a download (#10 §1, #12 §9). Over
 * an opened Test file the path keeps its name, as browsers never reveal its folder.
 */
export function SaveDialog({
  tests,
  opened,
  onSaved,
  onClose,
}: {
  tests: Tests;
  opened?: { name: string; file: TestFile; labels: string[] };
  onSaved: (name: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState(() =>
    opened
      ? `.github/whynorun/${opened.name}`
      : defaultTestPath(tests[0]!.label, tests[0]!.scenario),
  );
  const [text] = useState(() => writeTestFile(tests, opened?.file));
  // The opened file's tests no saved entry replaces, kept as they were (#12 §9).
  const others = (opened?.file.tests ?? []).filter(
    (t) => !tests.some((e) => e.label === t.label),
  );
  const name = path.slice(path.lastIndexOf("/") + 1);

  useEffect(() => {
    if (!dialog.current!.open) dialog.current!.showModal();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="save-title" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
          a.download = name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          onSaved(name);
          dialog.current!.close();
        }}
      >
        <h2 id="save-title">Save as Behaviour test</h2>
        <label htmlFor="save-path">Path</label>
        <input
          id="save-path"
          value={path}
          spellCheck={false}
          required
          pattern=".*[^/]"
          aria-describedby="save-path-hint"
          onChange={(e) => setPath(e.target.value)}
        />
        <p id="save-path-hint" className="hint">
          Commit it next to your GitHub workflows. WhyNoRun can&rsquo;t check
          whether this file already exists in the repo.
        </p>
        {/* Focusable, so the preview scrolls from the keyboard. */}
        <pre
          className="preview"
          role="region"
          aria-label="Preview"
          tabIndex={0}
        >
          {text}
        </pre>
        {others.length > 0 && (
          <ul className="hint" aria-label="Other tests">
            {others.map((t) => (
              <li key={t.label}>
                {t.label}: unchanged
                {opened!.labels.includes(t.label) ? "" : " (not opened)"}
              </li>
            ))}
          </ul>
        )}
        <p className="hint">
          Comments aren&rsquo;t kept here; <code>whynorun test --update</code>{" "}
          keeps them
        </p>
        <div className="row">
          <button type="submit">Save</button>
          <button type="button" onClick={() => dialog.current!.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
