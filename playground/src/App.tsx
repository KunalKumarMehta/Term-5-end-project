import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  PLATFORM_BASELINE,
  RULES,
  isLoaded,
  setScenarioValue,
  settleValue,
  simulate,
  validateScenario,
  type ActorKind,
  type Diagnostic,
  type Scenario,
  type Span,
  type Verdict,
  type WorkflowFile,
} from "../../src/core";
import { Access, isAccess } from "./Access";
import { ConfirmDialog, type Confirm } from "./ConfirmDialog";
import { Editor, type Target } from "./Editor";
import { EXAMPLE_FILES, EXAMPLE_LABEL, EXAMPLE_SCENARIO } from "./example";
import {
  Causes,
  Explanation,
  OWNER_REPO_ERROR,
  basename,
  isOwnerRepo,
  literal,
  prose,
  type CauseLinks,
} from "./Explanation";
import { Grid, Value, same, type Column } from "./Grid";
import { MergeReadiness, RequiredChecks } from "./MergeReadiness";
import { PasteDialog } from "./PasteDialog";
import { RepoFacts, sourceOf, type Fact } from "./RepoFacts";
import { fromDropped, fromPicked, type Upload } from "./upload";

type Pane = "yaml" | "scenario" | "results";

const INTERNAL_ERROR =
  "WhyNoRun hit an internal error on this input; these results are from before your last change";

const statusRegion = document.getElementById("status")!;
const toastRegion = document.getElementById("toasts")!;

/** #12 addendum E: per-key changes of `value` or `possible`, plus keys that came or went. */
function changedCount(before: Verdict[], after: Verdict[]): number {
  const old = new Map(before.map((v) => [v.key, v]));
  let n = 0;
  for (const v of after) {
    const was = old.get(v.key);
    old.delete(v.key);
    if (!same(was, v)) n++;
  }
  return n + old.size;
}

const sameFiles = (a: readonly WorkflowFile[], b: readonly WorkflowFile[]) =>
  a.length === b.length &&
  a.every((f, i) => f.path === b[i]!.path && f.text === b[i]!.text);

// The form keeps an empty date as "", and shows Verdicts only once one is set (#12 §3).
const BLANK: Scenario = { event: { name: "push" }, repo: { date: "" } };

// Diagnostics never depend on the Scenario, so this stands in for the date while it's empty.
const ANY_DATE = "2000-01-01";

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

/** A job key is `<file> › <jobId>`; a required check's `check › <name>` isn't, as no file is named check. */
const isJob = (key: string) => {
  const parts = key.split(" › ");
  return parts.length === 2 && parts[0] !== "check";
};

/** A nested payload's leaves as `[path segments, value]`; a list is one leaf. */
function leaves(node: unknown, at: string[] = []): [string[], unknown][] {
  return typeof node === "object" && node !== null && !Array.isArray(node)
    ? Object.entries(node).flatMap(([k, v]) => leaves(v, [...at, k]))
    : [[at, node]];
}

/** A copy of the Scenario without the field at `path`, leaving empty parents behind. */
function unset(scenario: Scenario, path: string[]): Scenario {
  const copy = JSON.parse(JSON.stringify(scenario)) as Record<string, unknown>;
  let node: Record<string, unknown> | undefined = copy;
  for (const seg of path.slice(0, -1))
    node = Object.hasOwn(node ?? {}, seg)
      ? (node![seg] as Record<string, unknown>)
      : undefined;
  if (node) delete node[path.at(-1)!];
  return copy as unknown as Scenario;
}

export function App() {
  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [origin, setOrigin] = useState<"example" | "pasted" | "uploaded">();
  // The files as the example or an upload loaded them, to tell when they've been edited.
  const [base, setBase] = useState<readonly WorkflowFile[]>();
  // The last upload's inline error, or its loaded · ignored summary (#12 §5).
  const [uploadNote, setUploadNote] = useState<ReactNode>();
  const [active, setActive] = useState<string>();
  // One Scenario, or two with Compare on (#9 §8).
  const [scenarios, setScenarios] = useState<Scenario[]>([BLANK]);
  const [labels, setLabels] = useState(["Scenario 1"]);
  // The Scenario the form shows, and the last label it refused (#12 §6).
  const [form, setForm] = useState(0);
  const [labelError, setLabelError] = useState<string>();
  // An owner/repo the check refused, shown while the Scenario keeps its last value (addendum B).
  const [repoDraft, setRepoDraft] = useState<string>();
  const [diffOnly, setDiffOnly] = useState(false);
  // The results tab (#9 §1); Concurrency arrives with its ticket.
  const [tab, setTab] = useState<"access" | "checks" | "all">("all");
  // Whether the Maintainer changed Scenario 1; Load example fills only an untouched one (#14 §3).
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>();
  // The job picked in the Assumptions section, before Add.
  const [failPick, setFailPick] = useState("");
  // Each Scenario's Verdicts; undefined while it has no date.
  const [runs, setRuns] = useState<(Verdict[] | undefined)[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [target, setTarget] = useState<Target>();
  const [failed, setFailed] = useState(false);
  const [pane, setPane] = useState<Pane>("yaml");
  const [pasting, setPasting] = useState(false);
  const [toast, setToast] = useState<{ id: number; node: ReactNode }>();
  const [status, setStatus] = useState("");
  // The open Explanation's subject key and Scenario, and the YAML lines a file:line link showed.
  const [open, setOpen] = useState<{ key: string; i: number }>();
  const [highlight, setHighlight] = useState<Span>();
  const sheet = useRef<HTMLElement>(null);
  const sheetScroll = useRef(0);
  const picker = useRef<HTMLInputElement>(null);

  // What the last run left on screen and what was last announced, read by the next run.
  const last = useRef<{
    runs: (Verdict[] | undefined)[];
    counts: Map<string, number>;
    failed: boolean;
    /** Set by a wholesale replacement, whose first run stays silent. */
    replaced?: boolean;
  }>({ runs: [], counts: new Map(), failed: false });

  const announce = useCallback((message: string) => {
    setStatus((prev) => (message === "" || message === prev ? prev : message));
  }, []);

  const compare = scenarios.length === 2;
  const scenario = scenarios[form]!;
  const label = labels[form]!;
  const eventName = scenario.event.name;
  const date = scenario.repo.date;

  useEffect(() => {
    // The field shows why; that Scenario's last results stay.
    if (scenarios.every((s) => s.event.name.trim() === "")) return;
    const timer = setTimeout(() => {
      if (files.length === 0) {
        last.current = { runs: [], counts: new Map(), failed: false };
        setRuns([]);
        setDiagnostics([]);
        setFailed(false);
        return;
      }
      const { runs: before, counts: was, replaced } = last.current;
      const next: (Verdict[] | undefined)[] = [];
      let diagnostics: Diagnostic[] = [];
      try {
        for (const [i, s] of scenarios.entries()) {
          if (s.event.name.trim() === "") {
            next.push(before[i]);
            continue;
          }
          const dated = s.repo.date !== "";
          // The Changed files field keeps the blank line being typed; simulate() gets only paths.
          const changed = s.event.changed;
          let input = changed
            ? setScenarioValue(
                s,
                ["event", "changed"],
                changed.filter((path) => path !== ""),
              )
            : s;
          if (!dated)
            input = setScenarioValue(input, ["repo", "date"], ANY_DATE);
          const result = simulate(files, input);
          diagnostics = result.diagnostics;
          next.push(dated ? result.verdicts : undefined);
        }
      } catch {
        if (!last.current.failed) announce(INTERNAL_ERROR);
        last.current.failed = true;
        setFailed(true);
        return;
      }
      const counts = countByPath(diagnostics);
      const news = diagnosticNews(was, counts);
      // Files with Diagnostics on either side are counted by their own news, not as Verdicts.
      const broken = new Set([...was.keys(), ...counts.keys()].map(basename));
      const kept = (vs: Verdict[]) =>
        vs.filter((v) => !broken.has(v.key.split(" › ")[0]!));
      // Per-Scenario keys; runs where either side had no Verdicts stay silent.
      let n = 0;
      next.forEach((after, i) => {
        const b = before[i];
        if (b?.length && after?.length) n += changedCount(kept(b), kept(after));
      });
      if (n > 0)
        news.unshift(`Results updated: ${plural(n, "Verdict")} changed`);
      if (!replaced) announce(news.join(" "));
      last.current = { runs: next, counts, failed: false };
      setRuns(next);
      setDiagnostics(diagnostics);
      setFailed(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [files, scenarios, announce]);

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
    if (files.length === 0) {
      setOrigin("pasted");
      setBase(undefined);
    }
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

  // #12 addendum J: the sheet belongs to Results and comes back where it was left.
  // Chromium keeps a hidden element's scroll offset; this restores it where an engine doesn't.
  useLayoutEffect(() => {
    if (pane === "results" && sheet.current)
      sheet.current.scrollTop = sheetScroll.current;
  }, [pane]);

  const openExplanation = (key: string, i = 0) => {
    sheetScroll.current = 0;
    if (sheet.current) sheet.current.scrollTop = 0;
    setOpen({ key, i });
  };

  const closeExplanation = ({ key, i }: { key: string; i: number }) => {
    setOpen(undefined);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-key="${CSS.escape(key)}"][data-scenario="${i}"]`,
        )
        ?.focus(),
    );
  };

  /** Shows the pane and Scenario tab a field lives in, then focuses the field. */
  const focusField = (id: string, i = form) => {
    setPane("scenario");
    setForm(i);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  const edited = base !== undefined && !sameFiles(files, base);

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
      ? [`It replaces your edits to the ${origin} files.`]
      : origin === "pasted" && files.length > 0
        ? [
            `It replaces your ${files.length} pasted file${files.length === 1 ? "" : "s"}.`,
          ]
        : [];

  // #12 addendum E: the first run after a wholesale replacement stays silent.
  const replaceFiles = (next: readonly WorkflowFile[]) => {
    last.current.replaced = true;
    setFiles([...next]);
    setBase(next);
    setUploadNote(undefined);
  };

  const loadExample = () =>
    ask({
      title: "Load the example?",
      losses: [
        ...setLosses(),
        ...(touched
          ? [
              `${labels[0]} keeps your changes, so it won't get the example's ${EXAMPLE_LABEL} Scenario.`,
            ]
          : []),
      ],
      action: "Load example",
      run: () => {
        replaceFiles(EXAMPLE_FILES);
        setOrigin("example");
        setActive(undefined);
        if (!touched) {
          setScenarios((ss) => [EXAMPLE_SCENARIO, ...ss.slice(1)]);
          setLabels((ls) => [EXAMPLE_LABEL, ...ls.slice(1)]);
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

  /** Upload and folder drop replace the whole set, under the confirm-first rule (#12 §1, §5). */
  const upload = async (reading: Promise<Upload>) => {
    setUploadNote(undefined);
    const read = await reading;
    if ("error" in read) {
      setUploadNote(
        <p className="error" role="alert">
          {read.error === "unreadable" ? (
            <>
              Couldn&rsquo;t read <code>{read.path}</code>: it isn&rsquo;t
              readable UTF-8 text, so nothing changed.
            </>
          ) : read.error === "test" ? (
            <>
              <code>{read.name}</code> is a Test file. Opening Test files
              isn&rsquo;t supported yet, so nothing changed.
            </>
          ) : (
            <>
              No <code>.yml</code>/<code>.yaml</code> files directly in{" "}
              <code>.github/workflows/</code>. WhyNoRun reads only those, as
              GitHub does.
            </>
          )}
        </p>,
      );
      return;
    }
    const { files: next, ignored } = read;
    const n = `${next.length} file${next.length === 1 ? "" : "s"}`;
    ask({
      title: "Replace the Workflow set?",
      losses: setLosses(),
      action: "Upload",
      run: () => {
        replaceFiles(next);
        setOrigin("uploaded");
        setActive(undefined);
        if (ignored.length > 0)
          setUploadNote(
            <details className="ignored">
              <summary>
                {next.length} loaded · {ignored.length} ignored (other types or
                subfolders)
              </summary>
              <ul>
                {ignored.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            </details>,
          );
        setToast({
          id: Date.now(),
          node: `Uploaded ${n}${ignored.length > 0 ? ` (${ignored.length} ignored)` : ""}`,
        });
      },
    });
  };

  // One drop zone covers the whole page, the editor included (#12 §5).
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      // The entries must be taken while the drop event lasts.
      const entries = [...e.dataTransfer.items].flatMap(
        (item) => item.webkitGetAsEntry() ?? [],
      );
      void upload(fromDropped(entries));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  /** Changes the Scenario the form shows; editing Scenario 1 touches it. */
  const setScenario = (change: (s: Scenario) => Scenario) => {
    setScenarios((ss) => ss.map((s, i) => (i === form ? change(s) : s)));
    if (form === 0) setTouched(true);
  };

  /** Sets one Scenario input from the form. */
  const setInput = (path: string[], value: unknown) =>
    setScenario((s) => setScenarioValue(s, path, value));

  /** Sets an optional Event field; emptied, it is unset so its default applies. */
  const setEventField = (
    field: "type" | "ref" | "base" | "message" | "login",
    value: string,
  ) =>
    setScenario((s) => {
      const event = { ...s.event, [field]: value };
      if (value === "") delete event[field];
      return { ...s, event };
    });

  /** Sets a Repo fact, which makes it set (#9 §6); emptied, it is unset so its default applies. */
  const setRepoFact = (field: Fact, value: unknown) =>
    setScenario((s) => {
      const repo = { ...s.repo, [field]: value };
      if (value === "") delete repo[field];
      return { ...s, repo };
    });

  /** Compare on copies Scenario 1 into Scenario 2 and opens its tab; off drops Scenario 2. */
  const setCompare = (on: boolean) => {
    setScenarios((ss) => (on ? [ss[0]!, ss[0]!] : [ss[0]!]));
    setLabels((ls) => (on ? [ls[0]!, "Scenario 2"] : [ls[0]!]));
    setForm(on ? 1 : 0);
    setLabelError(undefined);
    setRepoDraft(undefined);
    if (open?.i === 1) setOpen(undefined);
  };

  /** Checks owner/repo as typed; a refused value changes nothing, an empty one unsets it. */
  const setRepository = (value: string) => {
    if (value !== "" && !isOwnerRepo(value)) return setRepoDraft(value);
    setRepoDraft(undefined);
    setScenario((s) =>
      value === ""
        ? unset(s, ["repo", "repository"])
        : setScenarioValue(s, ["repo", "repository"], value),
    );
  };

  /**
   * #9 §7: settles a value in Scenario `i` only, which then re-simulates. A refused path or a
   * value the Scenario can't hold changes nothing and returns why, for the Settle it box.
   */
  const settle = (i: number, path: string, value: unknown) => {
    let next: Scenario;
    try {
      next = settleValue(scenarios[i]!, path, value);
    } catch (e) {
      return (e as Error).message;
    }
    const problems = validateScenario(next);
    if (problems.length > 0)
      return `${path} can't be ${literal(value)}: ${problems[0]}`;
    setScenarios((ss) => ss.map((s, j) => (j === i ? next : s)));
    if (i === 0) setTouched(true);
    setToast({
      id: Date.now(),
      node: (
        <>
          Settled{" "}
          <code>
            {path} = {literal(value)}
          </code>{" "}
          in {labels[i]}
        </>
      ),
    });
  };

  /** #12 §6: labels stay unique, and a cleared one becomes "Scenario N". Returns the label kept. */
  const rename = (typed: string): string => {
    const next = typed.trim() || `Scenario ${form + 1}`;
    if (labels.some((l, i) => i !== form && l === next)) {
      setLabelError(`${next} already uses this label.`);
      return label;
    }
    setLabelError(undefined);
    setLabels((ls) => ls.map((l, i) => (i === form ? next : l)));
    return next;
  };

  // Assumptions, keyed by job key ("job X fails").
  const assume = scenario.assume ?? {};
  const approvalSource = sourceOf(scenario, "event.approval");
  const remove = (path: string[]) => setScenario((s) => unset(s, path));

  const linksFor = (i: number): CauseLinks => ({
    files,
    focusField: (id) => focusField(id, i),
    source: (path) => sourceOf(scenarios[i]!, path),
    showLines: (span) => {
      setActive(span.path);
      setPane("yaml");
      setHighlight({ ...span }); // A fresh object, so a second click shows the lines again.
    },
  });

  const actions = (
    <div className="actions">
      <button type="button" onClick={loadExample}>
        Load example
      </button>
      <button type="button" onClick={() => setPasting(true)}>
        Paste
      </button>
      <button type="button" onClick={() => picker.current!.click()}>
        Upload
      </button>
      <button type="button" disabled>
        Import repo
      </button>
    </div>
  );

  const activeFile = files.find((f) => f.path === active) ?? files[0];
  const verdicts = runs[0];
  const unsupported = verdicts?.find(
    (v) => v.key === "event" && v.value === "unsupported",
  );
  // The jobs the form's Scenario could assume to fail.
  const unassumed = (runs[form] ?? [])
    .filter((v) => isJob(v.key) && !Object.hasOwn(assume, v.key))
    .map((v) => v.key);

  // Addendum C: a Scenario is blocked by a missing date, else by being unsupported.
  const columns: Column[] = scenarios.map((s, i) => {
    const event = runs[i]?.find(
      (v) => v.key === "event" && v.value === "unsupported",
    );
    if (s.repo.date === "")
      return {
        label: labels[i]!,
        blocked: "has no simulation date",
        header: <DatePrompt onClick={() => focusField("sim-date", i)} />,
      };
    if (event)
      return {
        label: labels[i]!,
        verdicts: [event],
        blocked: "is unsupported",
        header: <UnsupportedPanel verdict={event} {...linksFor(i)} />,
      };
    return { label: labels[i]!, verdicts: runs[i] };
  });

  // #12 addendum F: why a set with no Diagnostics-free caller has no Verdicts.
  const diagnosed = new Set(diagnostics.map((d) => d.path));
  const loaded = files.filter((f) => isLoaded(f.path));
  const noVerdicts = loaded.every((f) => diagnosed.has(f.path))
    ? "No Verdicts: every file has Diagnostics (see above)."
    : `No Verdicts: every file${diagnosed.size > 0 ? " has Diagnostics (see above) or" : ""} is only a called workflow (on: workflow_call), and its jobs appear under the jobs that call it.`;

  // #9 §4: the form Scenario's required checks, in Repo facts and atop Merge readiness.
  const requiredChecks = (
    <RequiredChecks
      required={scenario.repo.required ?? []}
      strict={scenario.repo.strict ?? false}
      onChange={(field, value) => setInput(["repo", field], value)}
      announce={announce}
    />
  );
  const mergeReadiness = (
    <MergeReadiness
      columns={columns}
      control={requiredChecks}
      open={open}
      onOpen={openExplanation}
    />
  );

  let results: ReactNode;
  if (files.length === 0)
    results = (
      <div className="whole-tab">
        <p>No Workflow set yet</p>
        {actions}
      </div>
    );
  else if (compare)
    results =
      tab === "checks" ? (
        mergeReadiness
      ) : tab === "access" ? (
        <Access
          columns={columns}
          open={open}
          onOpen={openExplanation}
          noVerdicts={noVerdicts}
        />
      ) : (
        <Grid
          columns={columns}
          files={files
            .filter((f) => isLoaded(f.path))
            .map((f) => basename(f.path))
            .sort()}
          diagnosed={new Set(diagnostics.map((d) => basename(d.path)))}
          diffOnly={diffOnly}
          setDiffOnly={setDiffOnly}
          open={open}
          onOpen={openExplanation}
        />
      );
  else if (columns[0]!.blocked === "has no simulation date")
    results = (
      <p className="whole-tab">
        <DatePrompt onClick={() => focusField("sim-date", 0)} />
      </p>
    );
  else if (verdicts === undefined) results = null;
  else if (unsupported)
    results = <UnsupportedPanel verdict={unsupported} {...linksFor(0)} />;
  // With no required checks there may be no Verdicts, and the control must stay (addendum F).
  else if (tab === "checks") results = mergeReadiness;
  else if (verdicts.length === 0) results = <p>{noVerdicts}</p>;
  else if (tab === "access")
    results = (
      <Access
        columns={columns}
        open={open}
        onOpen={openExplanation}
        noVerdicts={noVerdicts}
      />
    );
  else
    results = (
      <ul className="verdicts">
        {verdicts.map((v) => (
          // Sorted by key, so each job row follows its GitHub workflow's row, and its
          // access keys follow the job's.
          <li
            key={v.key}
            className={
              isJob(v.key) ? "job" : isAccess(v.key) ? "access" : undefined
            }
          >
            <button
              type="button"
              className="verdict"
              data-key={v.key}
              data-scenario={0}
              aria-expanded={open?.key === v.key}
              onClick={() => openExplanation(v.key)}
            >
              <span className="key">{v.key}</span> <Value verdict={v} />{" "}
              <span className="root">root {v.causes[0]?.rule}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  // Whether the whole tab is a no-set or no-date state, with no results to call stale.
  const wholeTab =
    files.length === 0 || (!compare && columns[0]!.blocked !== undefined);
  const counts = countByPath(diagnostics);

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
                : `Workflow set: ${files.length} ${origin} file${files.length === 1 ? "" : "s"}${edited ? " · edited" : ""}`}
          </span>
          {edited && origin === "example" && (
            <button type="button" onClick={reset}>
              Reset
            </button>
          )}
          <button type="button" onClick={() => setPasting(true)}>
            Paste
          </button>
          <button type="button" onClick={() => picker.current!.click()}>
            Upload
          </button>
          <label className="row">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />
            Compare
          </label>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void upload(fromPicked(e.target.files ?? []));
              e.target.value = ""; // Picking the same files again still uploads.
            }}
          />
          {uploadNote}
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
                highlight={highlight}
              />
            </>
          )}
        </section>

        <section className="pane" data-id="scenario" aria-label="Scenario">
          <div role="tablist" aria-label="Scenarios" className="tabs">
            {labels.map((l, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === form}
                onClick={() => {
                  setForm(i);
                  setLabelError(undefined);
                  setRepoDraft(undefined);
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <label htmlFor="scenario-label">Scenario label</label>
          <input
            // Uncontrolled, so a label is checked only once it's committed.
            key={`${form}:${label}`}
            id="scenario-label"
            defaultValue={label}
            maxLength={100}
            aria-invalid={labelError !== undefined}
            aria-describedby="scenario-label-error"
            onChange={() => setLabelError(undefined)}
            onBlur={(e) =>
              (e.currentTarget.value = rename(e.currentTarget.value))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter")
                e.currentTarget.value = rename(e.currentTarget.value);
            }}
          />
          <p id="scenario-label-error" className="error" role="alert">
            {labelError}
          </p>
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
            <label htmlFor="event-type">Activity type</label>
            <input
              id="event-type"
              list="event-types"
              placeholder="GitHub's defaults"
              value={scenario.event.type ?? ""}
              onChange={(e) => setEventField("type", e.target.value)}
            />
            <datalist id="event-types">
              <option value="opened" />
              <option value="synchronize" />
              <option value="reopened" />
              <option value="labeled" />
              <option value="closed" />
            </datalist>
            <label htmlFor="event-actor">Actor kind</label>
            <select
              id="event-actor"
              value={scenario.event.actor ?? "member"}
              onChange={(e) =>
                setInput(["event", "actor"], e.target.value as ActorKind)
              }
            >
              <option value="member">Member</option>
              <option value="fork">Fork contributor</option>
              <option value="dependabot">dependabot[bot]</option>
            </select>
            {scenario.event.actor === "fork" && (
              // #9 §6: only a fork contributor's run waits for approval.
              <>
                <label htmlFor="event-approval">
                  Approval{" "}
                  {/* aria-hidden: the field reads it as its description, not in its name. */}
                  <span
                    id="event-approval-source"
                    className={`source-tag ${approvalSource}`}
                    aria-hidden
                  >
                    {approvalSource}
                  </span>
                </label>
                <select
                  id="event-approval"
                  className={approvalSource}
                  aria-describedby="event-approval-source"
                  value={scenario.event.approval ?? "approved"}
                  onChange={(e) =>
                    setInput(["event", "approval"], e.target.value)
                  }
                >
                  <option value="approved">approved</option>
                  <option value="awaiting">awaiting</option>
                </select>
              </>
            )}
            <label htmlFor="event-ref">Ref</label>
            <input
              id="event-ref"
              placeholder="the default branch"
              aria-describedby="event-ref-hint"
              value={scenario.event.ref ?? ""}
              onChange={(e) => setEventField("ref", e.target.value)}
            />
            <p id="event-ref-hint" className="hint">
              A branch, <code>refs/heads/…</code> or <code>refs/tags/…</code>
            </p>
            <label htmlFor="event-base">Base branch</label>
            <input
              id="event-base"
              placeholder="the default branch"
              value={scenario.event.base ?? ""}
              onChange={(e) => setEventField("base", e.target.value)}
            />
            <label htmlFor="event-changed">Changed files</label>
            <textarea
              id="event-changed"
              rows={3}
              spellCheck={false}
              aria-describedby="event-changed-hint"
              value={(scenario.event.changed ?? []).join("\n")}
              onChange={(e) =>
                setInput(["event", "changed"], e.target.value.split("\n"))
              }
            />
            <p id="event-changed-hint" className="hint">
              One path per line, taken as the complete diff
            </p>
            <label htmlFor="event-message">Head commit message</label>
            <textarea
              id="event-message"
              rows={2}
              value={scenario.event.message ?? ""}
              onChange={(e) => setEventField("message", e.target.value)}
            />
            <label htmlFor="event-login">
              Actor login <span className="optional">(optional)</span>
            </label>
            <input
              id="event-login"
              aria-describedby="event-login-hint"
              value={scenario.event.login ?? ""}
              onChange={(e) => setEventField("login", e.target.value)}
            />
            <p id="event-login-hint" className="hint">
              Matters only when a GitHub workflow compares{" "}
              <code>github.actor</code> with a literal
            </p>
            <Entries
              label="Event payload values"
              entries={leaves(scenario.event.payload ?? {}).map(
                ([path, value]) => [
                  ["event", "payload", ...path],
                  `github.event.${path.join(".")}`,
                  value,
                ],
              )}
              remove={remove}
            />
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
            <RepoFacts scenario={scenario} onChange={setRepoFact} />
            {requiredChecks}
            <label htmlFor="repo-repository">
              <code>owner/repo</code>{" "}
              <span className="optional">(optional)</span>
              {scenario.repo.repository !== undefined && (
                <span className="source-tag set"> set</span>
              )}
            </label>
            <input
              id="repo-repository"
              spellCheck={false}
              value={repoDraft ?? scenario.repo.repository ?? ""}
              aria-invalid={repoDraft !== undefined}
              aria-describedby="repo-repository-hint repo-repository-error"
              onChange={(e) => setRepository(e.target.value)}
            />
            <p id="repo-repository-hint" className="hint">
              Matters only when a GitHub workflow compares{" "}
              <code>github.repository</code> with a literal
            </p>
            <p id="repo-repository-error" className="error" role="alert">
              {repoDraft !== undefined && OWNER_REPO_ERROR}
            </p>
            <Entries
              label="Repository variables"
              entries={Object.entries(scenario.repo.vars ?? {}).map(
                ([name, value]) => [
                  ["repo", "vars", name],
                  `vars.${name}`,
                  value,
                ],
              )}
              remove={remove}
            />
          </fieldset>
          <fieldset>
            <legend>Assumptions</legend>
            {Object.keys(assume).length === 0 ? (
              <p className="hint">None.</p>
            ) : (
              <ul className="assumptions">
                {Object.entries(assume).map(([key, value]) => (
                  <li key={key}>
                    {isJob(key) ? (
                      <>
                        job <code>{key}</code> {value}
                      </>
                    ) : (
                      // A job output, keyed by the producing job (#8 §5).
                      <code>
                        {key} = {literal(value)}
                      </code>
                    )}{" "}
                    <button
                      type="button"
                      aria-label={`Remove ${key} ${value}`}
                      onClick={() => remove(["assume", key])}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor="assume-fails">Assume this job fails</label>
            <div className="row">
              <select
                id="assume-fails"
                value={unassumed.includes(failPick) ? failPick : ""}
                onChange={(e) => setFailPick(e.target.value)}
              >
                <option value="">Choose a job</option>
                {unassumed.map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!unassumed.includes(failPick)}
                onClick={() => setInput(["assume", failPick], "fails")}
              >
                Add
              </button>
            </div>
          </fieldset>
        </section>

        <section className="pane" data-id="results" aria-label="Results">
          <div role="tablist" aria-label="Results" className="tabs">
            {(
              [
                ["access", "Access"],
                ["checks", "Merge readiness"],
                ["all", "All Verdicts"],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
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
          {failed && !wholeTab && <p className="banner">{INTERNAL_ERROR}</p>}
          <div className={failed && !wholeTab ? "stale" : undefined}>
            {results}
          </div>
          {open !== undefined &&
            files.length > 0 &&
            !columns[open.i]?.blocked && (
              <Explanation
                subject={open.key}
                scenario={compare ? labels[open.i] : undefined}
                verdict={runs[open.i]?.find((v) => v.key === open.key)}
                onClose={() => closeExplanation(open)}
                sheet={sheet}
                onScroll={(top) => (sheetScroll.current = top)}
                onSettle={(path, value) => settle(open.i, path, value)}
                {...linksFor(open.i)}
              />
            )}
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

/** Stored `path = value` entries in the section #8 §5 puts them in; nothing when there are none. */
function Entries({
  label,
  entries,
  remove,
}: {
  label: string;
  /** Each entry's Scenario path, its settle path and its value. */
  entries: [string[], string, unknown][];
  remove: (path: string[]) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <ul className="assumptions" aria-label={label}>
      {entries.map(([at, path, value]) => (
        <li key={path}>
          <code>
            {path} = {literal(value)}
          </code>{" "}
          <button
            type="button"
            aria-label={`Remove ${path}`}
            onClick={() => remove(at)}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function DatePrompt({ onClick }: { onClick: () => void }) {
  return (
    <a
      href="#sim-date"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      Set the simulation date to see Verdicts
    </a>
  );
}

function UnsupportedPanel({
  verdict,
  ...links
}: { verdict: Verdict } & CauseLinks) {
  const root = verdict.causes[0]!;
  return (
    <div className="unsupported">
      <p>
        Unsupported Scenario: {prose(RULES[root.rule]?.text ?? "")} ({root.rule}
        )
      </p>
      <Causes causes={verdict.causes} {...links} />
    </div>
  );
}
