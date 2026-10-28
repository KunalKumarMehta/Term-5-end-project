import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  PLATFORM_BASELINE,
  RULES,
  setScenarioValue,
  simulate,
  type Scenario,
  type Verdict,
  type WorkflowFile,
} from "../../src/core";
import { ConfirmDialog, type Confirm } from "./ConfirmDialog";
import { Editor } from "./Editor";
import { EXAMPLE_FILES, EXAMPLE_LABEL, EXAMPLE_SCENARIO } from "./example";
import { PasteDialog } from "./PasteDialog";

type Pane = "yaml" | "scenario" | "results";

const INTERNAL_ERROR =
  "WhyNoRun hit an internal error on this input; these results are from before your last change";

const statusRegion = document.getElementById("status")!;
const toastRegion = document.getElementById("toasts")!;

/** Renders `code` spans in the core's prose as code, and everything else as text. */
function prose(text: string): ReactNode {
  return text
    .split("`")
    .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

/** #12 addendum E: per-key changes of `value` or `possible`, plus keys that came or went. */
function changedCount(before: Verdict[], after: Verdict[]): number {
  const old = new Map(before.map((v) => [v.key, v]));
  let n = 0;
  for (const v of after) {
    const was = old.get(v.key);
    old.delete(v.key);
    if (!was || was.value !== v.value || !samePossible(was, v)) n++;
  }
  return n + old.size;
}

function samePossible(a: Verdict, b: Verdict): boolean {
  const key = (v: Verdict) => JSON.stringify([...(v.possible ?? [])].sort());
  return key(a) === key(b);
}

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const sameFiles = (a: readonly WorkflowFile[], b: readonly WorkflowFile[]) =>
  a.length === b.length &&
  a.every((f, i) => f.path === b[i]!.path && f.text === b[i]!.text);

// The form keeps an empty date as "", and simulates only once one is set (#12 §3).
const BLANK: Scenario = { event: { name: "push" }, repo: { date: "" } };

export function App() {
  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [origin, setOrigin] = useState<"example" | "pasted">();
  const [active, setActive] = useState<string>();
  const [scenario, setScenario] = useState(BLANK);
  const [label, setLabel] = useState("Scenario 1");
  // Whether the Maintainer changed Scenario 1; Load example fills only an untouched one (#14 §3).
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>();
  const [verdicts, setVerdicts] = useState<Verdict[]>();
  const [failed, setFailed] = useState(false);
  const [pane, setPane] = useState<Pane>("yaml");
  const [pasting, setPasting] = useState(false);
  const [toast, setToast] = useState<{ id: number; node: ReactNode }>();
  const [status, setStatus] = useState("");

  // What the last run left on screen and what was last announced, read by the next run.
  const last = useRef<{ verdicts?: Verdict[]; failed: boolean }>({
    failed: false,
  });

  const announce = useCallback((message: string) => {
    setStatus((prev) => (message === "" || message === prev ? prev : message));
  }, []);

  const eventName = scenario.event.name;
  const date = scenario.repo.date;

  useEffect(() => {
    if (scenario.event.name.trim() === "") return; // The field shows why; the last results stay.
    const timer = setTimeout(() => {
      if (files.length === 0 || scenario.repo.date === "") {
        last.current = { failed: false };
        setVerdicts(undefined);
        setFailed(false);
        return;
      }
      let next: Verdict[];
      try {
        next = simulate(files, scenario).verdicts;
      } catch {
        if (!last.current.failed) announce(INTERNAL_ERROR);
        last.current.failed = true;
        setFailed(true);
        return;
      }
      const before = last.current.verdicts;
      // Runs where either side had no Verdicts stay silent.
      if (before?.length && next.length) {
        const n = changedCount(before, next);
        if (n > 0)
          announce(
            `Results updated: ${n} Verdict${n === 1 ? "" : "s"} changed`,
          );
      }
      last.current = { verdicts: next, failed: false };
      setVerdicts(next);
      setFailed(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [files, scenario, announce]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const onEdit = useCallback((path: string, text: string) => {
    setFiles((fs) => fs.map((f) => (f.path === path ? { path, text } : f)));
  }, []);

  const addFile = (file: WorkflowFile) => {
    // Pasting into the example edits it; pasting into nothing starts a pasted set.
    if (files.length === 0) setOrigin("pasted");
    setFiles((fs) =>
      fs.some((f) => f.path === file.path)
        ? fs.map((f) => (f.path === file.path ? file : f))
        : [...fs, file],
    );
    setActive(file.path);
    setPasting(false);
    setToast({
      id: Date.now(),
      node: (
        <>
          Pasted <code>{basename(file.path)}</code>
        </>
      ),
    });
  };

  /** Shows the pane a field lives in, then focuses the field. */
  const focusField = (id: string) => {
    setPane("scenario");
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  const edited = origin === "example" && !sameFiles(files, EXAMPLE_FILES);

  /** The confirm-first rule (#12 §1): asks only when something would be lost. */
  const ask = (next: Confirm) => {
    if (next.losses.length > 0) setConfirm(next);
    else finish(next, true);
  };

  // Afterwards, focus moves to the header's Workflow set source (#14 §10).
  const finish = (done: Confirm, accepted: boolean) => {
    setConfirm(undefined);
    if (accepted) done.run();
    requestAnimationFrame(() => document.getElementById("set-source")?.focus());
  };

  /** What replacing the Workflow set would lose: edits, or files the Maintainer pasted. */
  const setLosses = () =>
    edited
      ? ["It replaces your edits to the example files."]
      : origin === "pasted" && files.length > 0
        ? [
            `It replaces your ${files.length} pasted file${files.length === 1 ? "" : "s"}.`,
          ]
        : [];

  // #12 addendum E: the first run after a wholesale replacement stays silent.
  const replaceFiles = (next: readonly WorkflowFile[]) => {
    last.current.verdicts = undefined;
    setFiles([...next]);
  };

  const loadExample = () =>
    ask({
      title: "Load the example?",
      losses: [
        ...setLosses(),
        ...(touched
          ? [
              `${label} keeps your changes, so it won't get the example's ${EXAMPLE_LABEL} Scenario.`,
            ]
          : []),
      ],
      action: "Load example",
      run: () => {
        replaceFiles(EXAMPLE_FILES);
        setOrigin("example");
        setActive(undefined);
        if (!touched) {
          setScenario(EXAMPLE_SCENARIO);
          setLabel(EXAMPLE_LABEL);
        }
        setToast({ id: Date.now(), node: "Loaded the example" });
      },
    });

  const reset = () =>
    ask({
      title: "Reset to the example files?",
      losses: setLosses(),
      action: "Reset",
      run: () => {
        replaceFiles(EXAMPLE_FILES);
        setToast({ id: Date.now(), node: "Reset to example files" });
      },
    });

  /** Sets one Scenario input from the form, which touches the Scenario. */
  const setInput = (path: string[], value: unknown) => {
    setScenario((s) => setScenarioValue(s, path, value));
    setTouched(true);
  };

  const actions = (
    <div className="actions">
      <button type="button" onClick={loadExample}>
        Load example
      </button>
      <button type="button" onClick={() => setPasting(true)}>
        Paste
      </button>
      <button type="button" disabled>
        Upload
      </button>
      <button type="button" disabled>
        Import repo
      </button>
    </div>
  );

  const activeFile = files.find((f) => f.path === active) ?? files[0];
  const unsupported = verdicts?.find(
    (v) => v.key === "event" && v.value === "unsupported",
  );

  let results: ReactNode;
  if (files.length === 0)
    results = (
      <div className="whole-tab">
        <p>No Workflow set yet</p>
        {actions}
      </div>
    );
  else if (date === "")
    results = (
      <p className="whole-tab">
        <a
          href="#sim-date"
          onClick={(e) => {
            e.preventDefault();
            focusField("sim-date");
          }}
        >
          Set the simulation date to see Verdicts
        </a>
      </p>
    );
  else if (verdicts === undefined) results = null;
  else if (unsupported)
    results = (
      <UnsupportedPanel verdict={unsupported} focusField={focusField} />
    );
  else if (verdicts.length === 0)
    results = <p>No Verdicts: every file has Diagnostics (see above).</p>;
  else
    results = (
      <ul className="verdicts">
        {verdicts.map((v) => (
          <li key={v.key}>
            <span className="key">{v.key}</span> <Value verdict={v} />{" "}
            <span className="root">root {v.causes[0]?.rule}</span>
          </li>
        ))}
      </ul>
    );

  const blocked = files.length === 0 || date === "";

  return (
    <>
      <header>
        <h1>WhyNoRun</h1>
        <div className="source">
          <span id="set-source" tabIndex={-1}>
            {files.length === 0
              ? "No Workflow set"
              : origin === "example"
                ? `Example${edited ? " · edited" : ""}`
                : `Workflow set: ${files.length} pasted file${files.length === 1 ? "" : "s"}`}
          </span>
          {edited && (
            <button type="button" onClick={reset}>
              Reset
            </button>
          )}
          <button type="button" onClick={() => setPasting(true)}>
            Paste
          </button>
        </div>
      </header>

      <main className="panes" data-pane={pane}>
        <section className="pane" data-id="yaml" aria-label="YAML">
          {files.length === 0 ? (
            <div className="whole-tab">
              <p>Start with a Workflow set.</p>
              {actions}
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="Files" className="tabs">
                {files.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    role="tab"
                    aria-selected={f === activeFile}
                    title={f.path}
                    onClick={() => setActive(f.path)}
                  >
                    {basename(f.path)}
                  </button>
                ))}
              </div>
              <Editor file={activeFile!} onEdit={onEdit} />
            </>
          )}
        </section>

        <section className="pane" data-id="scenario" aria-label="Scenario">
          <div role="tablist" aria-label="Scenarios" className="tabs">
            <button type="button" role="tab" aria-selected>
              {label}
            </button>
          </div>
          <fieldset>
            <legend>Event</legend>
            <label htmlFor="event-name">Event name</label>
            <input
              id="event-name"
              list="event-names"
              value={eventName}
              aria-invalid={eventName.trim() === ""}
              aria-describedby="event-name-error"
              onChange={(e) => setInput(["event", "name"], e.target.value)}
            />
            <datalist id="event-names">
              <option value="push" />
              <option value="pull_request" />
              <option value="pull_request_target" />
              <option value="merge_group" />
            </datalist>
            <p id="event-name-error" className="error">
              {eventName.trim() === "" && "Enter an event name, such as push"}
            </p>
          </fieldset>
          <fieldset>
            <legend>Repo facts</legend>
            <label htmlFor="sim-date">
              Simulation date <span className="required">(required)</span>
            </label>
            <div className="row">
              <input
                id="sim-date"
                type="date"
                required
                value={date}
                onChange={(e) => setInput(["repo", "date"], e.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  setInput(
                    ["repo", "date"],
                    new Date().toLocaleDateString("en-CA"),
                  )
                }
              >
                Today
              </button>
            </div>
          </fieldset>
        </section>

        <section className="pane" data-id="results" aria-label="Results">
          <div role="tablist" aria-label="Results" className="tabs">
            <button type="button" role="tab" aria-selected>
              All Verdicts
            </button>
          </div>
          {failed && !blocked && <p className="banner">{INTERNAL_ERROR}</p>}
          <div className={failed && !blocked ? "stale" : undefined}>
            {results}
          </div>
        </section>
      </main>

      <footer>
        <span>whynorun {__VERSION__}</span>
        <details>
          <summary>What WhyNoRun always assumes</summary>
          <ul>
            {PLATFORM_BASELINE.map((item) => (
              <li key={item}>{prose(item)}</li>
            ))}
          </ul>
        </details>
        <a href="THIRD_PARTY_LICENSES.md">Third-party licences</a>
      </footer>

      <nav className="pane-bar" aria-label="Panes">
        {(
          [
            ["yaml", "YAML"],
            ["scenario", "Scenario"],
            ["results", "Results"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={pane === id}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {pasting && (
        <PasteDialog
          files={files}
          onAdd={addFile}
          onClose={() => setPasting(false)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          onClose={(accepted) => finish(confirm, accepted)}
        />
      )}
      {createPortal(status, statusRegion)}
      {createPortal(
        toast && (
          <p key={toast.id} className="toast">
            {toast.node}
          </p>
        ),
        toastRegion,
      )}
    </>
  );
}

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

function Value({ verdict }: { verdict: Verdict }) {
  return (
    <span className="value" data-tone={TONES[verdict.value] ?? "neutral"}>
      {verdict.value}
      {verdict.possible && ` (${verdict.possible.join(", ")})`}
    </span>
  );
}

// The Scenario inputs that have a form field so far; the others arrive with their tickets.
const FIELDS: Record<string, { id: string; label: string }> = {
  "event.name": { id: "event-name", label: "Event name" },
  "repo.date": { id: "sim-date", label: "Simulation date" },
};
const LABELS: Record<string, string> = { "event.actor": "Actor kind" };

function UnsupportedPanel({
  verdict,
  focusField,
}: {
  verdict: Verdict;
  focusField: (id: string) => void;
}) {
  const root = verdict.causes[0]!;
  return (
    <div className="unsupported">
      <p>
        Unsupported Scenario: {prose(RULES[root.rule]?.text ?? "")} ({root.rule}
        )
      </p>
      <ol className="explanation">
        {verdict.causes.map((cause, i) => (
          <li key={i}>
            {i === 0 && <span className="root">root </span>}
            {cause.rule}: {prose(RULES[cause.rule]?.text ?? "")}
            <ul>
              {cause.inputs.map(({ path, value }) => {
                const field = FIELDS[path];
                const text = `${field?.label ?? LABELS[path] ?? path} = ${String(value)}`;
                return (
                  <li key={path}>
                    {field ? (
                      <a
                        href={`#${field.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(field.id);
                        }}
                      >
                        {text}
                      </a>
                    ) : (
                      text
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
