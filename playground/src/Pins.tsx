import { createContext, useContext, useEffect, useRef, useState } from "react";
import { writeTestFile, type Scenario } from "../../src/core";

/** Pins by Scenario: a pin is one (Scenario, subject key) pair (#9 §3). */
export const Pins = createContext<
  | {
      pinned: (i: number, key: string) => boolean;
      toggle: (i: number, key: string) => void;
    }
  | undefined
>(undefined);

/** The pin icon beside a Verdict row; its pressed state is the feedback (#12 §1, addendum E). */
export function PinToggle({ i, subject }: { i: number; subject: string }) {
  const pins = useContext(Pins);
  if (!pins) return null;
  return (
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

/** The tray's Save dialog: an editable path, a preview, then a download (#10 §1, #12 §9). */
export function SaveDialog({
  tests,
  onSaved,
  onClose,
}: {
  tests: Tests;
  onSaved: (name: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState(() =>
    defaultTestPath(tests[0]!.label, tests[0]!.scenario),
  );
  const [text] = useState(() => writeTestFile(tests));
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
