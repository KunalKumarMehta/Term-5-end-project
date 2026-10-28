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
  simulate,
  type Diagnostic,
  type Verdict,
  type WorkflowFile,
} from "../../src/core";
import { Editor, type Target } from "./Editor";
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function countByPath(diagnostics: Diagnostic[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of diagnostics)
    counts.set(d.path, (counts.get(d.path) ?? 0) + 1);
  return counts;
}

/** #12 addendum E: "· `ci.yml` has N Diagnostics" or "· `ci.yml` Diagnostics cleared". */
function diagnosticNews(
  before: Map<string, number>,
  after: Map<string, number>,
): string[] {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.flatMap((path) => {
    const n = after.get(path) ?? 0;
    if (n === (before.get(path) ?? 0)) return [];
    return n
      ? [`· ${basename(path)} has ${plural(n, "Diagnostic")}`]
      : [`· ${basename(path)} Diagnostics cleared`];
  });
}

// Diagnostics never depend on the Scenario, so this stands in for the date while it's empty.
const ANY_DATE = "2000-01-01";

export function App() {
  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [active, setActive] = useState<string>();
  const [eventName, setEventName] = useState("push");
  const [date, setDate] = useState("");
  const [verdicts, setVerdicts] = useState<Verdict[]>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [target, setTarget] = useState<Target>();
  const [failed, setFailed] = useState(false);
  const [pane, setPane] = useState<Pane>("yaml");
  const [pasting, setPasting] = useState(false);
  const [toast, setToast] = useState<{ id: number; node: ReactNode }>();
  const [status, setStatus] = useState("");

  // What the last run left on screen and what was last announced, read by the next run.
  const last = useRef<{
    verdicts?: Verdict[];
    counts: Map<string, number>;
    failed: boolean;
  }>({ counts: new Map(), failed: false });

  const announce = useCallback((message: string) => {
    setStatus((prev) => (message === "" || message === prev ? prev : message));
  }, []);

  useEffect(() => {
    if (eventName.trim() === "") return; // The field shows why; the last results stay.
    const timer = setTimeout(() => {
      if (files.length === 0) {
        last.current = { counts: new Map(), failed: false };
        setVerdicts(undefined);
        setDiagnostics([]);
        setFailed(false);
        return;
      }
      let result;
      try {
        result = simulate(files, {
          event: { name: eventName },
          repo: { date: date || ANY_DATE },
        });
      } catch {
        if (!last.current.failed) announce(INTERNAL_ERROR);
        last.current.failed = true;
        setFailed(true);
        return;
      }
      const next = date === "" ? undefined : result.verdicts;
      const counts = countByPath(result.diagnostics);
      const { verdicts: before, counts: was } = last.current;
      const news = diagnosticNews(was, counts);
      // Files with Diagnostics on either side are counted by their own news, not as Verdicts.
      const broken = new Set([...was.keys(), ...counts.keys()].map(basename));
      const kept = (vs: Verdict[]) =>
        vs.filter((v) => !broken.has(v.key.split(" › ")[0]!));
      // Runs where either side had no Verdicts stay silent.
      if (before?.length && next?.length) {
        const n = changedCount(kept(before), kept(next));
        if (n > 0)
          news.unshift(`Results updated: ${plural(n, "Verdict")} changed`);
      }
      announce(news.join(" "));
      last.current = { verdicts: next, counts, failed: false };
      setVerdicts(next);
      setDiagnostics(result.diagnostics);
      setFailed(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [files, eventName, date, announce]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const onEdit = useCallback((path: string, text: string) => {
    setFiles((fs) => fs.map((f) => (f.path === path ? { path, text } : f)));
  }, []);

  const addFile = (file: WorkflowFile) => {
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

  const actions = (
    <div className="actions">
      <button type="button" disabled>
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
  const counts = countByPath(diagnostics);

  return (
    <>
      <header>
        <h1>WhyNoRun</h1>
        <div className="source">
          <span>
            {files.length === 0
              ? "No Workflow set"
              : `Workflow set: ${files.length} pasted file${files.length === 1 ? "" : "s"}`}
          </span>
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
                    {counts.has(f.path) && (
                      <>
                        {" "}
                        <span className="count">
                          {counts.get(f.path)}
                          <span className="visually-hidden">
                            {counts.get(f.path) === 1
                              ? " Diagnostic"
                              : " Diagnostics"}
                          </span>
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              <Editor
                file={activeFile!}
                diagnostics={diagnostics}
                target={target}
                onEdit={onEdit}
              />
            </>
          )}
        </section>

        <section className="pane" data-id="scenario" aria-label="Scenario">
          <div role="tablist" aria-label="Scenarios" className="tabs">
            <button type="button" role="tab" aria-selected>
              Scenario 1
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
              onChange={(e) => setEventName(e.target.value)}
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
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setDate(new Date().toLocaleDateString("en-CA"))}
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
          {diagnostics.length > 0 && (
            <ul className="banner diagnostics" aria-label="Diagnostics">
              {diagnostics.map((d) => (
                <li key={`${d.path}:${d.line}:${d.col}:${d.message}`}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // #12 §10: on a narrow screen this also switches to the YAML tab.
                      setPane("yaml");
                      setActive(d.path);
                      setTarget({ path: d.path, line: d.line, col: d.col });
                    }}
                  >
                    <code>
                      {basename(d.path)}:{d.line}
                    </code>{" "}
                    {d.message}
                  </a>
                </li>
              ))}
            </ul>
          )}
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
