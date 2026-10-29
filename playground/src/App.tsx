import {
  Fragment,
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
  blocksUpdate,
  compareTest,
  isCheck,
  isConcurrency,
  isJobKey,
  isLoaded,
  parseTestFile,
  producedChecks,
  setScenarioValue,
  settleValue,
  simulate,
  updatedPins,
  validateScenario,
  type ActorKind,
  type Diagnostic,
  type Finding,
  type Pin,
  type Scenario,
  type Span,
  type TestFile,
  type UnmatchedAssumption,
  type Verdict,
  type WorkflowFile,
} from "../../src/core";
import { Access, isAccess } from "./Access";
import { Concurrency } from "./Concurrency";
import { ConfirmDialog, type Confirm } from "./ConfirmDialog";
import {
  KEY as DRAFT_KEY,
  discardDraft,
  readDraft,
  toDraft,
  when,
  writeDraft,
  type Held,
} from "./draft";
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
import { ImportForm } from "./ImportForm";
import {
  importRepo,
  type Failure,
  type Imported,
  type ImportedFacts,
} from "./importRepo";
import { PENDING, decodeLink, encodeLink, isLink, type Opening } from "./link";
import { MergeReadiness, RequiredChecks, producedNews } from "./MergeReadiness";
import { InvalidTestDialog, TestPicker } from "./OpenTest";
import { PasteDialog } from "./PasteDialog";
import {
  OpenedTest,
  PinToggle,
  Pins,
  SaveDialog,
  type TestStatus,
} from "./Pins";
import { RepoFacts, sourceOf, tagText, titleOf, type Fact } from "./RepoFacts";
import { ShareDialog } from "./Share";
import { fromDropped, fromPicked, type Upload } from "./upload";

type Pane = "yaml" | "scenario" | "results";

const INTERNAL_ERROR =
  "WhyNoRun hit an internal error on this input; these results are from before your last change";

const NOT_SAVING = "Not saving a draft in this browser";
const SAVED_OVER = "Another WhyNoRun tab saved over this draft";
const CLEARED = "Another WhyNoRun tab cleared the saved draft";

/** A link in the fragment, removed before it's decoded so a crash can't repeat (#14 §6.1). */
function takeLink(): string | undefined {
  const fragment = location.hash;
  if (!isLink(fragment)) return;
  history.replaceState(history.state, "", location.pathname + location.search);
  return fragment;
}

function pendingLink(): string | undefined {
  try {
    return sessionStorage.getItem(PENDING) ?? undefined;
  } catch {
    return undefined;
  }
}

function forgetLink() {
  try {
    sessionStorage.removeItem(PENDING);
  } catch {
    // Nothing was kept where storage is blocked.
  }
}

// A link at load, or one a reload left pending, which then opens again (#14 §9).
const bootLink = takeLink() ?? pendingLink();

/** The import messages of #7 and #12 §4, for a reference link that couldn't load (#14 §9). */
function failureText(f: Failure): string {
  switch (f.kind) {
    case "repo":
      return "Not found or private. Private repos aren’t supported.";
    case "ref":
      return "No branch, tag or commit with this SHA.";
    case "folder":
      return "No GitHub workflows at this ref.";
    case "none":
      return "No .yml/.yaml files directly in .github/workflows/.";
    case "rate":
      return `GitHub allows 60 requests an hour without sign-in, and they’re used up${
        f.reset
          ? ` until ${f.reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : ""
      }.`;
    case "network":
      return `Couldn’t reach GitHub${f.status === undefined ? "" : ` (${f.status})`}.`;
  }
}

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

/** An Event name being typed: the field shows why, and the Scenario keeps its last results. */
const unnamed = (s: Scenario) =>
  s.event.name.trim() === "" || s.followUp?.name.trim() === "";

/** The Changed files field keeps the blank line being typed; simulate() gets only paths. */
function withoutBlankPaths(s: Scenario): Scenario {
  let input = s;
  for (const on of ["event", "followUp"] as const) {
    const changed = s[on]?.changed;
    if (changed)
      input = setScenarioValue(
        input,
        [on, "changed"],
        changed.filter((path) => path !== ""),
      );
  }
  return input;
}

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

/** The Test file Open test loaded, and what it put in the Scenarios and tray (#12 §9). */
export interface Opened {
  name: string;
  /** The file as opened, which the draft keeps so its unopened tests stay verbatim (#14 §2). */
  text: string;
  file: TestFile;
  /** The tests opened as Scenario tabs, by index in the file. */
  chosen: number[];
  /** The Scenarios and pinned keys as opened, to tell when they've changed (#14 §10). */
  scenarios: Scenario[];
  keys: string[][];
  /** Each Scenario's loaded pins with their own field lists, re-pointed ones under their new key. */
  loaded: Record<string, Pin>[];
}

const failing = (f: Finding) =>
  f.status !== "match" && f.status !== "file has Diagnostics";

export function App() {
  // A readable draft restores on load, with no confirm: nothing in memory is replaced (#14 §4).
  const [boot] = useState(readDraft);
  const held = boot.held;
  const [files, setFiles] = useState<WorkflowFile[]>(held?.files ?? []);
  const [origin, setOrigin] = useState(held?.origin);
  // The import behind an imported set; a Repo fact holding its value shows ⤓ imported (#9 §6).
  const [imported, setImported] = useState(held?.imported);
  // Whether the import form is open, and the files when its import started (#12 §1).
  const [importing, setImporting] = useState(false);
  const importStart = useRef<readonly WorkflowFile[]>([]);
  // The files as the example, an upload or an import loaded them, to tell when they've been edited.
  const [base, setBase] = useState(held?.base);
  // The last upload's inline error, or its loaded · ignored summary (#12 §5).
  const [uploadNote, setUploadNote] = useState<ReactNode>();
  const [active, setActive] = useState<string>();
  // One Scenario, or two with Compare on (#9 §8).
  const [scenarios, setScenarios] = useState<Scenario[]>(
    held?.scenarios ?? [BLANK],
  );
  const [labels, setLabels] = useState(held?.labels ?? ["Scenario 1"]);
  // Each Scenario's pinned subject keys, in the order pinned (#9 §3).
  const [pins, setPins] = useState<string[][]>(held?.pins ?? [[]]);
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(held?.opened);
  // A Test file with more than two tests, waiting for the picker, or one that's invalid.
  const [choosing, setChoosing] = useState<{
    name: string;
    text: string;
    file: TestFile;
  }>();
  const [invalidTest, setInvalidTest] = useState<{
    name: string;
    errors: string[];
  }>();
  // The Scenario the form shows, and the last label it refused (#12 §6).
  const [form, setForm] = useState(0);
  const [labelError, setLabelError] = useState<string>();
  // An owner/repo the check refused, shown while the Scenario keeps its last value (addendum B).
  const [repoDraft, setRepoDraft] = useState<string>();
  const [diffOnly, setDiffOnly] = useState(false);
  // The results tab (#9 §1).
  const [tab, setTab] = useState<"access" | "checks" | "concurrency" | "all">(
    "all",
  );
  // Whether the Maintainer changed Scenario 1; Load example fills only an untouched one (#14 §3).
  const [touched, setTouched] = useState(held?.touched ?? false);
  const [confirm, setConfirm] = useState<Confirm>();
  // The job picked in the Assumptions section, before Add.
  const [failPick, setFailPick] = useState("");
  // Each Scenario's Verdicts; undefined while it has no date.
  const [runs, setRuns] = useState<(Verdict[] | undefined)[]>([]);
  // Each Scenario's Assumptions that point at nothing.
  const [unmatched, setUnmatched] = useState<UnmatchedAssumption[][]>([]);
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
  const testPicker = useRef<HTMLInputElement>(null);
  // The last run's news, announced with the tray's count once both are rendered; null is silent.
  const newsRef = useRef<string[] | null>([]);
  const lastTray = useRef(0);

  // What the last run left on screen and what was last announced, read by the next run.
  const last = useRef<{
    runs: (Verdict[] | undefined)[];
    counts: Map<string, number>;
    failed: boolean;
    /** Set by a wholesale replacement, whose first run stays silent. */
    replaced?: boolean;
    // A restore is one too (#14 §12).
  }>({ runs: [], counts: new Map(), failed: false, replaced: !!held });

  const announce = useCallback((message: string) => {
    setStatus((prev) => (message === "" || message === prev ? prev : message));
  }, []);

  const compare = scenarios.length === 2;
  const scenario = scenarios[form]!;
  const label = labels[form]!;
  const date = scenario.repo.date;

  useEffect(() => {
    // The field shows why; that Scenario's last results stay.
    if (scenarios.every(unnamed)) return;
    const timer = setTimeout(() => {
      if (files.length === 0) {
        last.current = { runs: [], counts: new Map(), failed: false };
        newsRef.current = null;
        setRuns([]);
        setUnmatched([]);
        setDiagnostics([]);
        setFailed(false);
        return;
      }
      const { runs: before, counts: was, replaced } = last.current;
      const next: (Verdict[] | undefined)[] = [];
      const nextUnmatched: UnmatchedAssumption[][] = [];
      let diagnostics: Diagnostic[] = [];
      try {
        for (const [i, s] of scenarios.entries()) {
          if (unnamed(s)) {
            next.push(before[i]);
            nextUnmatched.push(unmatched[i] ?? []);
            continue;
          }
          const dated = s.repo.date !== "";
          let input = withoutBlankPaths(s);
          if (!dated)
            input = setScenarioValue(input, ["repo", "date"], ANY_DATE);
          const result = simulate(files, input);
          diagnostics = result.diagnostics;
          next.push(dated ? result.verdicts : undefined);
          nextUnmatched.push(dated ? result.unmatchedAssumptions : []);
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
      newsRef.current = replaced ? null : news;
      last.current = { runs: next, counts, failed: false };
      setRuns(next);
      setUnmatched(nextUnmatched);
      setDiagnostics(diagnostics);
      setFailed(false);
    }, 300);
    return () => clearTimeout(timer);
    // unmatched only carries an unnamed Scenario's last result over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // #12 §10: on a narrow screen this also switches to the YAML tab.
  const showDiagnostic = (d: Diagnostic) => {
    setPane("yaml");
    setActive(d.path);
    setTarget({ path: d.path, line: d.line, col: d.col });
  };

  /** Shows a pane, then focuses an element in it. */
  const focusIn = (to: Pane, id: string) => {
    setPane(to);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  /** Shows the pane and Scenario tab a field lives in, then focuses the field. */
  const focusField = (id: string, i = form) => {
    setPane("scenario");
    setForm(i);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  // An edited import from a link has no original files, only its reference (#14 §7).
  const edited =
    base !== undefined ? !sameFiles(files, base) : origin === "imported";

  // #14 §4: the draft's save time, a failed store, another tab's notice and an unreadable draft.
  const [saved, setSaved] = useState(boot.saved);
  const [notSaving, setNotSaving] = useState(false);
  const [tabNotice, setTabNotice] = useState<string>();
  const [unreadable, setUnreadable] = useState(boot.unreadable);
  const latest = useRef<Held>(undefined);
  useLayoutEffect(() => {
    latest.current = {
      files,
      origin,
      imported,
      base,
      edited,
      scenarios,
      labels,
      pins,
      touched,
      opened,
    };
  });
  const autosave = useRef({
    // Changes this tab hasn't written, and whether another tab's notice holds them back.
    dirty: false,
    paused: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    failed: false,
    // An unreadable draft under this version's key isn't overwritten until it's discarded.
    blocked: boot.unreadable?.key === DRAFT_KEY,
    watched: undefined as unknown[] | undefined,
  });

  const writeNow = useCallback(() => {
    const a = autosave.current;
    clearTimeout(a.timer);
    const h = latest.current!;
    // A Scenario whose Event name is being typed can't be read back, so it waits for the name.
    if (a.blocked || h.scenarios.some(unnamed)) return;
    const now = new Date();
    const draft = toDraft(h, now);
    a.dirty = false;
    a.paused = false;
    setTabNotice(undefined);
    if (writeDraft(draft)) {
      setNotSaving(false);
      setSaved(draft && now);
      return;
    }
    setNotSaving(true);
    setSaved(undefined);
    if (!a.failed) announce(NOT_SAVING);
    a.failed = true;
  }, [announce]);

  // Each change marks this tab's work unwritten, and writes 500 ms after the last one.
  useEffect(() => {
    const a = autosave.current;
    const now = [
      files,
      base,
      imported,
      scenarios,
      labels,
      pins,
      touched,
      opened,
    ];
    const was = a.watched;
    a.watched = now;
    if (!was || now.every((v, i) => Object.is(v, was[i]))) return;
    a.dirty = true;
    a.paused = false;
    clearTimeout(a.timer);
    a.timer = setTimeout(writeNow, 500);
  }, [
    files,
    base,
    imported,
    scenarios,
    labels,
    pins,
    touched,
    opened,
    writeNow,
  ]);

  useEffect(() => {
    const flush = () => {
      const a = autosave.current;
      if (a.dirty && !a.paused) writeNow();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // Only this key, or null for another page's clear() (#14 §4).
    const storage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== DRAFT_KEY && e.key !== null) return;
      const a = autosave.current;
      a.paused = true;
      clearTimeout(a.timer);
      const notice =
        e.key === null || e.newValue === null ? CLEARED : SAVED_OVER;
      setTabNotice(notice);
      announce(notice);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("storage", storage);
    };
  }, [writeNow, announce]);

  // #14 §12: one announcement at load, once the first render has settled.
  useEffect(() => {
    const said = boot.saved
      ? `Restored your draft, saved ${when(boot.saved)}`
      : boot.unreadable?.reason;
    // A link at load makes its own announcement.
    if (!said || bootLink) return;
    const timer = setTimeout(() => announce(said), 0);
    return () => clearTimeout(timer);
  }, [boot, announce]);

  /** The confirm-first rule (#12 §1): asks only when something would be lost. */
  const ask = (next: Confirm) => {
    if (next.losses.length > 0) setConfirm(next);
    else finish(next, true);
  };

  // Afterwards, focus moves to the header's Workflow set source (#14 §10).
  const finish = (done: Confirm, accepted: boolean) => {
    setConfirm(undefined);
    if (accepted) done.run();
    else done.keep?.();
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
        ...(opened
          ? [
              `${labels[0]} comes from ${opened.name}, so it won't get the example's ${EXAMPLE_LABEL} Scenario.`,
            ]
          : touched
            ? [
                `${labels[0]} keeps your changes, so it won't get the example's ${EXAMPLE_LABEL} Scenario.`,
              ]
            : []),
      ],
      action: "Load example",
      run: () => {
        replaceFiles(EXAMPLE_FILES);
        setOrigin("example");
        setImported(undefined);
        setActive(undefined);
        // #14 §3: only an untouched Scenario 1, with no Test file open.
        if (!touched && !opened) {
          setScenarios((ss) => [EXAMPLE_SCENARIO, ...ss.slice(1)]);
          setLabels((ls) => [EXAMPLE_LABEL, ...ls.slice(1)]);
        }
        setToast({ id: Date.now(), node: "Loaded the example" });
      },
    });

  // Restores the example's or the import's files (#9 §5).
  const reset = () =>
    ask({
      title: `Reset to the ${origin} files?`,
      losses: setLosses(),
      action: "Reset",
      run: () => {
        replaceFiles(base!);
        setToast({ id: Date.now(), node: `Reset to ${origin} files` });
      },
    });

  /** #14 §11: clears the set, the Scenarios, the tray and the opened Test file, and the draft. */
  const startOver = () =>
    ask({
      title: "Start over?",
      losses: [...setLosses(), ...openLosses()],
      action: "Start over",
      run: () => {
        last.current.replaced = true;
        setFiles([]);
        setOrigin(undefined);
        setImported(undefined);
        setBase(undefined);
        setUploadNote(undefined);
        setActive(undefined);
        setScenarios([BLANK]);
        setLabels(["Scenario 1"]);
        setPins([[]]);
        setOpened(undefined);
        setTouched(false);
        setForm(0);
        setLabelError(undefined);
        setRepoDraft(undefined);
        setOpen(undefined);
        writeDraft(undefined);
        setSaved(undefined);
        setToast({ id: Date.now(), node: "Started over" });
      },
    });

  /**
   * #86: every file has arrived, so the import replaces the set under the confirm rule. A
   * Re-import (same repo) refreshes only the facts that still hold the import's values, in
   * every Scenario; a new import fills them all (#9 §5).
   */
  const finishImport = (got: Imported, focused: boolean) => {
    setImporting(false);
    const before =
      origin === "imported" &&
      imported?.owner === got.owner &&
      imported.repo === got.repo
        ? imported.facts
        : undefined;
    const sha7 = got.sha.slice(0, 7);
    const next: Confirm = {
      title: !sameFiles(files, importStart.current)
        ? "Replace the edits you made during the import?"
        : before
          ? "Re-import?"
          : "Import the repo?",
      losses: setLosses(),
      action: before ? "Re-import" : "Import",
      run: () => {
        replaceFiles(got.files);
        setOrigin("imported");
        setActive(undefined);
        setScenarios((ss) =>
          ss.map((s) => {
            const repo = { ...s.repo };
            for (const field of Object.keys(
              got.facts,
            ) as (keyof ImportedFacts)[])
              if (!before || repo[field] === before[field])
                Object.assign(repo, { [field]: got.facts[field] });
            return { ...s, repo };
          }),
        );
        setImported(got);
        setToast({
          id: Date.now(),
          node: before
            ? `Re-imported @ ${sha7}`
            : `Imported ${got.owner}/${got.repo} @ ${sha7} · ${got.files.length} loaded${got.ignored.length > 0 ? ` · ${got.ignored.length} ignored` : ""}`,
        });
      },
    };
    if (next.losses.length > 0) return setConfirm(next);
    next.run();
    // #12 addendum E: from Cancel to the first file tab, as the form that started it is gone.
    if (focused)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('[aria-label="Files"] [role="tab"]')
          ?.focus(),
      );
  };

  /** What opening a Test file would lose (#12 §1, #14 §10). */
  const openLosses = () => {
    const scenariosChanged = opened
      ? scenarios.length !== opened.scenarios.length ||
        scenarios.some((s, i) => s !== opened.scenarios[i]) ||
        labels.some((l, i) => l !== opened.file.tests[opened.chosen[i]!]?.label)
      : touched ||
        (compare &&
          (scenarios[1] !== scenarios[0] || labels[1] !== "Scenario 2"));
    const pinsChanged =
      opened !== undefined &&
      (pins.some(
        (p, i) => p.join("\n") !== (opened.keys[i] ?? []).join("\n"),
      ) ||
        // Accept all rewrote them (#14 §10).
        opened.loaded.some(
          (l, i) => l !== opened.file.tests[opened.chosen[i]!]?.pins,
        ));
    return [
      ...(scenariosChanged
        ? [`It replaces your changes to ${labels.join(" and ")}.`]
        : []),
      ...(pinsChanged
        ? [`It drops your changes to the pins from ${opened.name}.`]
        : !opened && pins.flat().length > 0
          ? [
              `It replaces your ${plural(pins.flat().length, "pinned Verdict")}.`,
            ]
          : []),
    ];
  };

  // #14 §8–9: the share popover's link, and a link's banner: bad, loading or failed.
  const [share, setShare] = useState<{ url?: string }>();
  const [linkNote, setLinkNote] = useState<{
    text: string;
    retry?: { opening: Opening; what: string };
  }>();
  const linkRun = useRef<AbortController>(undefined);

  const copyLink = () => {
    setShare({});
    void encodeLink(latest.current!, open).then((fragment) =>
      setShare({
        url: location.origin + location.pathname + location.search + fragment,
      }),
    );
  };

  /** #14 §9 steps 4–6: cancels a running import, loads the link's set, and only then replaces. */
  const loadLink = async (opening: Opening, what: string) => {
    // Closing the import form cancels its import, as its Cancel button does.
    setImporting(false);
    linkRun.current?.abort();
    let next = opening.held;
    const reference = opening.reference;
    if (reference) {
      const controller = new AbortController();
      linkRun.current = controller;
      setLinkNote({ text: "Opening the shared playground…" });
      let got: Imported | Failure;
      try {
        got = await importRepo(
          reference.owner,
          reference.repo,
          reference.sha,
          () => {},
          controller.signal,
        );
      } catch {
        return; // Dismissed, or another link took its place.
      }
      if (!("files" in got)) {
        // The pending key keeps the link, so a reload tries again (#14 §9).
        const text = `The shared playground couldn't load: ${failureText(got)}`;
        setLinkNote({ text, retry: { opening, what } });
        announce(text);
        return;
      }
      next = {
        ...next,
        files: got.files,
        base: got.files,
        imported: {
          ...next.imported!,
          ref: reference.ref,
          files: got.files,
          ignored: got.ignored,
        },
      };
    }
    linkRun.current = undefined;
    setLinkNote(undefined);
    // A wholesale replacement: the first run stays silent (#14 §12).
    last.current.replaced = true;
    newsRef.current = null;
    setFiles(next.files);
    setOrigin(next.origin);
    setImported(next.imported);
    setBase(next.base);
    setUploadNote(undefined);
    setActive(undefined);
    setScenarios(next.scenarios);
    setLabels(next.labels);
    setPins(next.pins);
    setOpened(undefined);
    // Scenarios from a link count as touched (#14 §3).
    setTouched(true);
    setForm(0);
    setLabelError(undefined);
    setRepoDraft(undefined);
    sheetScroll.current = 0;
    setOpen(opening.open);
    forgetLink();
    setToast({ id: Date.now(), node: "Opened shared playground" });
    announce(`Opened shared playground: ${what}`);
  };

  /** #14 §9: a link is checked, kept pending, and opened under the confirm-first rule. */
  const openLink = async (fragment: string, atLoad = false) => {
    const got = await decodeLink(fragment);
    if ("error" in got) {
      forgetLink();
      setLinkNote({ text: got.error });
      announce(
        atLoad && boot.saved ? `${got.error}. Restored your draft` : got.error,
      );
      return;
    }
    try {
      sessionStorage.setItem(PENDING, fragment);
    } catch {
      // Storage refuses: the link still opens, but a reload can't bring it back.
    }
    const { held: h } = got;
    const what = h.imported
      ? `${h.imported.owner}/${h.imported.repo} @ ${h.imported.sha.slice(0, 7)}`
      : plural(h.files.length, "file");
    ask({
      title: `Open the shared playground (${what}, ${plural(h.scenarios.length, "Scenario")})?`,
      losses: [...setLosses(), ...openLosses()],
      action: "Open link",
      run: () => void loadLink(got, what),
      // Keep my draft leaves a running import alone, and forgets the link.
      keep: forgetLink,
    });
  };
  const openLinkRef = useRef<typeof openLink>(undefined);
  useLayoutEffect(() => {
    openLinkRef.current = openLink;
  });

  useEffect(() => {
    // After the first render settles; its announcement stands in for the restore's (#14 §12).
    const timer = setTimeout(
      () => bootLink && void openLinkRef.current!(bootLink, true),
      0,
    );
    // Links are also accepted through hashchange (#14 §9).
    const changed = () => {
      const fragment = takeLink();
      if (fragment) void openLinkRef.current!(fragment);
    };
    window.addEventListener("hashchange", changed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", changed);
    };
  }, []);

  /** Opens the chosen tests as the Scenario tabs, replacing the Scenarios and tray (#12 §9). */
  const openTests = (
    name: string,
    text: string,
    file: TestFile,
    chosen: number[],
  ) =>
    ask({
      title: `Open ${name}?`,
      losses: openLosses(),
      action: "Open test",
      run: () => {
        const tests = chosen.map((i) => file.tests[i]!);
        const opening = tests.map((t) => t.scenario);
        const keys = tests.map((t) => Object.keys(t.pins));
        // #12 addendum E: the first run stays silent, as the toast speaks.
        last.current.replaced = true;
        newsRef.current = null;
        setScenarios(opening);
        setLabels(tests.map((t) => t.label));
        setPins(keys);
        setOpened({
          name,
          text,
          file,
          chosen,
          scenarios: opening,
          keys,
          loaded: tests.map((t) => t.pins),
        });
        // Scenarios from a Test file count as touched (#14 §3).
        setTouched(true);
        setForm(0);
        setLabelError(undefined);
        setRepoDraft(undefined);
        setOpen(undefined);
        setToast({
          id: Date.now(),
          node: (
            <>
              Opened <code>{name}</code>
            </>
          ),
        });
      },
    });

  /** Open test… or a dropped Test file: invalid loads nothing, more than two tests asks which. */
  const openTestFile = (name: string, text: string) => {
    const parsed = parseTestFile(name, text);
    if (parsed.errors) return setInvalidTest({ name, errors: parsed.errors });
    if (parsed.file.tests.length > 2)
      return setChoosing({ name, text, file: parsed.file });
    openTests(
      name,
      text,
      parsed.file,
      parsed.file.tests.map((_, i) => i),
    );
  };

  /** Re-points a pin, keeping its place and its loaded fields (#12 §9, addendum G). */
  const repoint = (i: number, from: string, to: string) => {
    setPins((ps) =>
      ps.map((p, j) => (j === i ? p.map((k) => (k === from ? to : k)) : p)),
    );
    setOpened(
      (o) =>
        o && {
          ...o,
          loaded: o.loaded.map((l, j) =>
            j === i
              ? Object.fromEntries(
                  Object.entries(l).map(([k, pin]) => [
                    k === from ? to : k,
                    pin,
                  ]),
                )
              : l,
          ),
        },
    );
  };

  /** Upload and folder drop replace the whole set, under the confirm-first rule (#12 §1, §5). */
  const upload = async (reading: Promise<Upload>) => {
    setUploadNote(undefined);
    const read = await reading;
    if ("test" in read)
      return openTestFile(
        read.test.name,
        new TextDecoder().decode(await read.test.read()),
      );
    if ("error" in read) {
      setUploadNote(
        <p className="error" role="alert">
          {read.error === "unreadable" ? (
            <>
              Couldn&rsquo;t read <code>{read.path}</code>: it isn&rsquo;t
              readable UTF-8 text, so nothing changed.
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
        // No import backs the facts any more, so they show as set (#9 §5).
        setImported(undefined);
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
    on: "event" | "followUp",
    field: "type" | "ref" | "base" | "message" | "login",
    value: string,
  ) =>
    setScenario((s) => {
      const event = { ...s[on]!, [field]: value };
      if (value === "") delete event[field];
      return { ...s, [on]: event };
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
    setPins((ps) => (on ? [ps[0]!, []] : [ps[0]!]));
    setOpened((o) => o && { ...o, loaded: o.loaded.slice(0, 1) });
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
   * An Event value goes on the Event the Verdict reads: run B's is the Follow-up event.
   */
  const settle = (
    i: number,
    path: string,
    value: unknown,
    on: "event" | "followUp" = "event",
  ) => {
    let next: Scenario;
    try {
      next = settleValue(scenarios[i]!, path, value, on);
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
  // #12 §9: Assumptions that point at nothing, whether or not a Test file is open.
  const notFound = new Map(
    (unmatched[form] ?? []).map((u) => [u.key, u.candidates]),
  );
  /** Re-points an Assumption onto a job, keeping an output's path after it. */
  const reassume = (from: string, job: string) =>
    setScenario((s) => ({
      ...s,
      assume: Object.fromEntries(
        Object.entries(s.assume ?? {}).map(([k, v]) => [
          k === from ? onJob(from, job) : k,
          v,
        ]),
      ),
    }));
  const eventApprovalSource = sourceOf(scenario, "event.approval");
  const repositorySource = sourceOf(
    scenario,
    "repo.repository",
    imported?.facts,
  );
  const remove = (path: string[]) => setScenario((s) => unset(s, path));

  const linksFor = (i: number): CauseLinks => ({
    files,
    focusField: (id) => focusField(id, i),
    source: (path) => sourceOf(scenarios[i]!, path, imported?.facts),
    showLines: (span) => {
      setActive(span.path);
      setPane("yaml");
      setHighlight({ ...span }); // A fresh object, so a second click shows the lines again.
    },
  });

  /** The Event's fields, or the Follow-up event's (#9 §1), under their own ids. */
  const eventFields = (on: "event" | "followUp") => {
    const ev = scenario[on]!;
    const id = on === "event" ? "event" : "follow-up";
    const legend = on === "event" ? "Event" : "Follow-up event";
    const approvalSource = on === "event" ? eventApprovalSource : undefined;
    return (
      <>
        <label htmlFor={`${id}-name`}>Event name</label>
        <input
          id={`${id}-name`}
          list={`${id}-names`}
          value={ev.name}
          aria-invalid={ev.name.trim() === ""}
          aria-describedby={`${id}-name-error`}
          onChange={(e) => setInput([on, "name"], e.target.value)}
        />
        <datalist id={`${id}-names`}>
          <option value="push" />
          <option value="pull_request" />
          <option value="pull_request_target" />
          <option value="merge_group" />
        </datalist>
        <p id={`${id}-name-error`} className="error">
          {ev.name.trim() === "" && "Enter an event name, such as push"}
        </p>
        <label htmlFor={`${id}-type`}>Activity type</label>
        <input
          id={`${id}-type`}
          list={`${id}-types`}
          placeholder="GitHub's defaults"
          value={ev.type ?? ""}
          onChange={(e) => setEventField(on, "type", e.target.value)}
        />
        <datalist id={`${id}-types`}>
          <option value="opened" />
          <option value="synchronize" />
          <option value="reopened" />
          <option value="labeled" />
          <option value="closed" />
        </datalist>
        <label htmlFor={`${id}-actor`}>Actor kind</label>
        <select
          id={`${id}-actor`}
          value={ev.actor ?? "member"}
          onChange={(e) => setInput([on, "actor"], e.target.value as ActorKind)}
        >
          <option value="member">Member</option>
          <option value="fork">Fork contributor</option>
          <option value="dependabot">dependabot[bot]</option>
        </select>
        {ev.actor === "fork" && (
          // #9 §6: only a fork contributor's run waits for approval.
          <>
            <label htmlFor={`${id}-approval`}>
              Approval{" "}
              {/* aria-hidden: the field reads it as its description, not in its name. */}
              {approvalSource && (
                <span
                  id={`${id}-approval-source`}
                  className={`source-tag ${approvalSource}`}
                  aria-hidden
                >
                  {approvalSource}
                </span>
              )}
            </label>
            <select
              id={`${id}-approval`}
              className={approvalSource}
              aria-describedby={approvalSource && `${id}-approval-source`}
              value={ev.approval ?? "approved"}
              onChange={(e) => setInput([on, "approval"], e.target.value)}
            >
              <option value="approved">approved</option>
              <option value="awaiting">awaiting</option>
            </select>
          </>
        )}
        <label htmlFor={`${id}-ref`}>Ref</label>
        <input
          id={`${id}-ref`}
          placeholder="the default branch"
          aria-describedby={`${id}-ref-hint`}
          value={ev.ref ?? ""}
          onChange={(e) => setEventField(on, "ref", e.target.value)}
        />
        <p id={`${id}-ref-hint`} className="hint">
          A branch, <code>refs/heads/…</code> or <code>refs/tags/…</code>
        </p>
        <label htmlFor={`${id}-base`}>Base branch</label>
        <input
          id={`${id}-base`}
          placeholder="the default branch"
          value={ev.base ?? ""}
          onChange={(e) => setEventField(on, "base", e.target.value)}
        />
        <label htmlFor={`${id}-changed`}>Changed files</label>
        <textarea
          id={`${id}-changed`}
          rows={3}
          spellCheck={false}
          aria-describedby={`${id}-changed-hint`}
          value={(ev.changed ?? []).join("\n")}
          onChange={(e) =>
            setInput([on, "changed"], e.target.value.split("\n"))
          }
        />
        <p id={`${id}-changed-hint`} className="hint">
          One path per line, taken as the complete diff
        </p>
        <label htmlFor={`${id}-message`}>Head commit message</label>
        <textarea
          id={`${id}-message`}
          rows={2}
          value={ev.message ?? ""}
          onChange={(e) => setEventField(on, "message", e.target.value)}
        />
        <label htmlFor={`${id}-login`}>
          Actor login <span className="optional">(optional)</span>
        </label>
        <input
          id={`${id}-login`}
          aria-describedby={`${id}-login-hint`}
          value={ev.login ?? ""}
          onChange={(e) => setEventField(on, "login", e.target.value)}
        />
        <p id={`${id}-login-hint`} className="hint">
          Matters only when a GitHub workflow compares <code>github.actor</code>{" "}
          with a literal
        </p>
        <Entries
          label={`${legend} payload values`}
          entries={leaves(ev.payload ?? {}).map(([path, value]) => [
            [on, "payload", ...path],
            `github.event.${path.join(".")}`,
            value,
          ])}
          remove={remove}
        />
      </>
    );
  };

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
      <button type="button" onClick={() => setImporting(true)}>
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
    .filter((v) => isJobKey(v.key) && !Object.hasOwn(assume, v.key))
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
      mergeQueue={scenario.repo.mergeQueue ?? false}
      onChange={(field, value) => setInput(["repo", field], value)}
      announce={announce}
      onRequireProduced={() => {
        // Ordinary Repo facts: the button stores nothing about itself (#9 §4).
        const required = scenario.repo.required ?? [];
        const { names, left } = producedChecks(files, scenario);
        const added = names.filter((n) => !required.includes(n));
        setInput(["repo", "required"], [...required, ...added]);
        setToast({ id: Date.now(), node: producedNews(added.length, left) });
      }}
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

  const concurrency = (
    <Concurrency
      columns={columns}
      states={scenarios.map(
        (s) => s.followUp && (s.followUp.runA ?? "in-progress"),
      )}
      pendingRuns={scenarios.map((s) => s.followUp?.pendingRuns ?? 0)}
      diagnosed={diagnostics.length > 0}
      open={open}
      onOpen={openExplanation}
      onAddFollowUp={(i) => focusField("follow-up-add", i)}
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
      ) : tab === "concurrency" ? (
        concurrency
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
  else if (tab === "concurrency") results = concurrency;
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
              isJobKey(v.key) ? "job" : isAccess(v.key) ? "access" : undefined
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
            <PinToggle i={0} subject={v.key} />
          </li>
        ))}
      </ul>
    );

  // Whether the whole tab is a no-set or no-date state, with no results to call stale.
  const wholeTab =
    files.length === 0 || (!compare && columns[0]!.blocked !== undefined);
  const counts = countByPath(diagnostics);

  const pinned = (i: number, key: string) => pins[i]?.includes(key) ?? false;
  const togglePin = (i: number, key: string) =>
    setPins((ps) =>
      ps.map((p, j) =>
        j !== i
          ? p
          : p.includes(key)
            ? p.filter((k) => k !== key)
            : [...p, key],
      ),
    );
  const inTab = (key: string, verdicts: Verdict[]) =>
    tab === "access"
      ? isAccess(key) || verdicts.some((v) => v.key === `${key} › secrets`)
      : tab === "checks"
        ? isCheck(key)
        : tab === "concurrency"
          ? isConcurrency(key)
          : true;
  // #9 §3: every Verdict of this tab, for the Scenarios shown.
  const tabKeys = columns.map((c) =>
    c.blocked || !c.verdicts
      ? []
      : c.verdicts.filter((v) => inTab(v.key, c.verdicts!)).map((v) => v.key),
  );
  const pinCount = pins.flat().length;
  // Each Scenario's loaded pins still in the tray, in the tray's order.
  const loadedPins = (i: number) => {
    const loaded = opened?.loaded[i];
    return loaded
      ? Object.fromEntries(
          (pins[i] ?? [])
            .filter((k) => Object.hasOwn(loaded, k))
            .map((k) => [k, loaded[k]!]),
        )
      : undefined;
  };
  // What `whynorun test` would report for each opened test (#12 §9), or why it's waiting.
  const statuses = scenarios.map((s, i) => {
    const loaded = loadedPins(i);
    if (!loaded) return undefined;
    const verdicts = runs[i];
    const waiting =
      files.length === 0
        ? "waiting for a Workflow set"
        : s.repo.date === ""
          ? "waiting for the simulation date"
          : undefined;
    const test = { label: labels[i]!, scenario: s, pins: loaded };
    const result =
      waiting || !verdicts
        ? undefined
        : { verdicts, diagnostics, unmatchedAssumptions: unmatched[i] ?? [] };
    const findings = result ? compareTest(test, result) : [];
    return {
      waiting,
      findings,
      pins: Object.keys(loaded).length,
      test,
      result,
    };
  });
  const pinStatus = (i: number, key: string) =>
    statuses[i]?.findings.find(
      (f) => (f.status === "match" || f.status === "changed") && f.key === key,
    );
  // #12 §9: everything that would make the CLI exit 1, plus the pins still waiting.
  const evaluated = statuses.some((t) => t && t.waiting === undefined);
  const wouldFail =
    statuses.reduce(
      (n, t) => n + (t?.findings.filter(failing).length ?? 0),
      0,
    ) + (evaluated ? counts.size : 0);
  const waitingPins = statuses.reduce(
    (n, t) => n + (t?.waiting ? t.pins : 0),
    0,
  );

  // #12 §9: Accept all mirrors `test --update`, all or nothing, listing what blocks it.
  const blocking = statuses.flatMap((t, i) =>
    (t?.findings ?? []).filter(blocksUpdate).map((f) => ({ f, i })),
  );
  const blockers = [
    ...(
      [
        ["pinned subject not found", "pin", "not found"],
        ["assumed subject not found", "Assumption", "not found"],
        ["Scenario unsupported", "Scenario", "unsupported"],
      ] as const
    ).flatMap(([kind, word, what]) => {
      const all = blocking.filter(({ f }) => f.status === kind);
      const first = all[0];
      if (!first) return [];
      const { f, i } = first;
      const go =
        f.status === "assumed subject not found"
          ? () => focusField(`assumed:${f.key}`, i)
          : () =>
              focusIn(
                "results",
                f.status === "pinned subject not found"
                  ? `not-found:${labels[i]}:${f.key}`
                  : `unsupported:${labels[i]}`,
              );
      return [
        {
          key: kind,
          label: `${plural(all.length, word)} ${what}` as ReactNode,
          go,
        },
      ];
    }),
    ...(evaluated
      ? [...counts.keys()].map((path) => ({
          key: path,
          label: (
            <>
              <code>{basename(path)}</code> has Diagnostics
            </>
          ) as ReactNode,
          go: () => showDiagnostic(diagnostics.find((d) => d.path === path)!),
        }))
      : []),
  ];
  const changedPins = statuses.reduce(
    (n, t) =>
      n + (t?.findings.filter((f) => f.status === "changed").length ?? 0),
    0,
  );
  const canAccept =
    blockers.length === 0 && waitingPins === 0 && changedPins > 0;

  const acceptAll = () => {
    const updates = statuses.map((t) =>
      t?.result ? updatedPins(t.test, t.result) : {},
    );
    setOpened(
      (o) =>
        o && {
          ...o,
          loaded: o.loaded.map((l, i) =>
            Object.keys(updates[i] ?? {}).length > 0
              ? { ...l, ...updates[i] }
              : l,
          ),
        },
    );
    setToast({
      id: Date.now(),
      node: `Accepted ${plural(changedPins, "changed pin")}`,
    });
  };
  // The tray saves one Test file with an entry per Scenario that has a pinned Verdict.
  const tests = scenarios.flatMap((s, i) => {
    const pinnedVerdicts = (runs[i] ?? []).filter((v) => pinned(i, v.key));
    const loaded = loadedPins(i);
    return (pinnedVerdicts.length === 0 && !Object.keys(loaded ?? {}).length) ||
      unnamed(s)
      ? []
      : [
          {
            label: labels[i]!,
            scenario: withoutBlankPaths(s),
            pinned: pinnedVerdicts,
            loaded,
          },
        ];
  });

  // #12 addendum E: the run's news, then "· tray: N would fail" when that count changes.
  useEffect(() => {
    const said = newsRef.current;
    newsRef.current = [];
    const changed = wouldFail !== lastTray.current;
    lastTray.current = wouldFail;
    if (said === null) return;
    announce(
      [...said, ...(changed ? [`· tray: ${wouldFail} would fail`] : [])].join(
        " ",
      ),
    );
  }, [runs, wouldFail, announce]);

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
                : origin === "imported"
                  ? `${imported!.owner}/${imported!.repo} @ ${imported!.sha.slice(0, 7)} (${imported!.ref})${edited ? " · edited since import" : ""}`
                  : `Workflow set: ${files.length} ${origin} file${files.length === 1 ? "" : "s"}${edited ? " · edited" : ""}`}
          </span>
          {edited &&
            base &&
            (origin === "example" || origin === "imported") && (
              <button type="button" onClick={reset}>
                Reset
              </button>
            )}
          {notSaving ? (
            <span className="hint">{NOT_SAVING}</span>
          ) : (
            saved && <span className="hint">Draft · saved {when(saved)}</span>
          )}
          <button type="button" onClick={startOver}>
            Start over
          </button>
          <button
            type="button"
            disabled={files.length === 0}
            onClick={copyLink}
          >
            Copy link
          </button>
          <button type="button" onClick={() => setImporting(true)}>
            {origin === "imported" ? "Re-import" : "Import repo"}
          </button>
          <button type="button" onClick={() => setPasting(true)}>
            Paste
          </button>
          <button type="button" onClick={() => picker.current!.click()}>
            Upload
          </button>
          <button type="button" onClick={() => testPicker.current!.click()}>
            Open test…
          </button>
          <input
            ref={testPicker}
            type="file"
            accept=".yml,.yaml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // Picking the same file again still opens it.
              if (file)
                void file.text().then((t) => openTestFile(file.name, t));
            }}
          />
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
          {linkNote && (
            <p className="banner">
              {linkNote.text}{" "}
              {linkNote.retry && (
                <button
                  type="button"
                  onClick={() =>
                    void loadLink(linkNote.retry!.opening, linkNote.retry!.what)
                  }
                >
                  Retry
                </button>
              )}{" "}
              <button
                type="button"
                onClick={() => {
                  linkRun.current?.abort();
                  forgetLink();
                  setLinkNote(undefined);
                }}
              >
                Dismiss
              </button>
            </p>
          )}
          {tabNotice && (
            <p className="banner">
              {tabNotice}{" "}
              <button type="button" onClick={writeNow}>
                Save this tab&rsquo;s work
              </button>
            </p>
          )}
          {unreadable && (
            <p className="banner">
              {unreadable.reason}{" "}
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(
                    new Blob([unreadable.raw], { type: "application/json" }),
                  );
                  a.download = "whynorun-draft.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                }}
              >
                Download
              </button>{" "}
              <button
                type="button"
                onClick={() => {
                  discardDraft(unreadable.key);
                  autosave.current.blocked = false;
                  setUnreadable(undefined);
                }}
              >
                Discard
              </button>
            </p>
          )}
          {importing && (
            <ImportForm
              initial={
                origin === "imported"
                  ? {
                      name: `${imported!.owner}/${imported!.repo}`,
                      ref: imported!.ref,
                    }
                  : undefined
              }
              announce={(message) => {
                // Each import speaks, even one that repeats the last: emptied, the region changes.
                setStatus("");
                requestAnimationFrame(() => announce(message));
              }}
              onStart={() => (importStart.current = files)}
              onImported={finishImport}
              onClose={() => setImporting(false)}
            />
          )}
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
            {eventFields("event")}
          </fieldset>
          <fieldset id="follow-up">
            <legend>Follow-up event</legend>
            {scenario.followUp ? (
              <>
                {eventFields("followUp")}
                <label htmlFor="follow-up-run-a">Run A when B arrives</label>
                <select
                  id="follow-up-run-a"
                  value={scenario.followUp.runA ?? "in-progress"}
                  onChange={(e) =>
                    setInput(["followUp", "runA"], e.target.value)
                  }
                >
                  <option value="in-progress">in progress</option>
                  <option value="pending">pending</option>
                </select>
                <label htmlFor="follow-up-pending-runs">
                  Runs already pending
                </label>
                <input
                  id="follow-up-pending-runs"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={scenario.followUp.pendingRuns ?? 0}
                  aria-describedby="follow-up-pending-runs-hint"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    // The schema takes a whole number from 0 to 100: anything else is left as it was.
                    if (Number.isInteger(n) && n >= 0 && n <= 100)
                      setInput(["followUp", "pendingRuns"], n);
                  }}
                />
                <p id="follow-up-pending-runs-hint" className="hint">
                  For a <code>queue: max</code> group: how many runs already
                  wait in it besides run A. It holds up to 100 (CC-3).
                </p>
                <button type="button" onClick={() => remove(["followUp"])}>
                  Remove Follow-up event
                </button>
              </>
            ) : (
              <>
                <p className="hint">
                  A second Event that arrives while run A is in progress or
                  pending, for the Concurrency tab.
                </p>
                <button
                  type="button"
                  id="follow-up-add"
                  onClick={() => setInput(["followUp"], scenario.event)}
                >
                  Add a Follow-up event
                </button>
              </>
            )}
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
            <RepoFacts
              scenario={scenario}
              imported={imported}
              onChange={setRepoFact}
            />
            {requiredChecks}
            <label htmlFor="repo-repository">
              <code>owner/repo</code>{" "}
              <span className="optional">(optional)</span>
              {repositorySource && (
                <>
                  {" "}
                  <span
                    id="repo-repository-source"
                    className={`source-tag ${repositorySource}`}
                    title={
                      repositorySource === "imported"
                        ? titleOf(imported!)
                        : undefined
                    }
                  >
                    {tagText(repositorySource)}
                  </span>
                </>
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
                    {isJobKey(key) ? (
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
                    {notFound.has(key) && (
                      <p className="error" id={`assumed:${key}`} tabIndex={-1}>
                        assumed subject not found
                        {notFound.get(key)!.length > 0 && <> · re-point to </>}
                        {notFound.get(key)!.map((job) => {
                          const taken = Object.hasOwn(assume, onJob(key, job));
                          return (
                            // Re-pointing never overwrites or merges (addendum G).
                            <button
                              key={job}
                              type="button"
                              disabled={taken}
                              onClick={() => reassume(key, job)}
                            >
                              {onJob(key, job)}
                              {taken && " (already assumed)"}
                            </button>
                          );
                        })}
                      </p>
                    )}
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
                ["concurrency", "Concurrency"],
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
                      showDiagnostic(d);
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
          {(tabKeys.flat().length > 0 || pinCount > 0) && (
            <div className="row tray">
              {tabKeys.flat().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const already = tabKeys.flatMap((keys, i) =>
                      keys.filter((k) => pinned(i, k)),
                    ).length;
                    setPins((ps) =>
                      ps.map((p, i) => [
                        ...p,
                        ...(tabKeys[i] ?? []).filter((k) => !p.includes(k)),
                      ]),
                    );
                    setToast({
                      id: Date.now(),
                      node: `Pinned ${tabKeys.flat().length - already} (${already} already pinned)`,
                    });
                  }}
                >
                  Pin all in this tab
                </button>
              )}
              {pinCount > 0 && (
                <button
                  type="button"
                  disabled={tests.length === 0}
                  onClick={() => setSaving(true)}
                >
                  {pinCount} pinned · Save as Behaviour test…
                </button>
              )}
              {opened && (
                <span className="tray-status">
                  {wouldFail} would fail
                  {waitingPins > 0 && ` · ${waitingPins} waiting`}
                </span>
              )}
              {opened && (
                <button
                  type="button"
                  disabled={!canAccept}
                  aria-describedby={
                    blockers.length > 0 ? "blocked-by" : undefined
                  }
                  onClick={acceptAll}
                >
                  Accept all changes
                </button>
              )}
              {opened && blockers.length > 0 && (
                <span id="blocked-by" className="blocked-by">
                  Blocked by:{" "}
                  {blockers.map((b, k) => (
                    <Fragment key={b.key}>
                      {k > 0 && ", "}
                      <button type="button" onClick={b.go}>
                        {b.label}
                      </button>
                    </Fragment>
                  ))}
                </span>
              )}
            </div>
          )}
          {opened && (
            <OpenedTest
              name={opened.name}
              tests={statuses.flatMap((t, i): TestStatus[] =>
                t
                  ? [
                      {
                        label: labels[i]!,
                        waiting: t.waiting,
                        findings: t.findings,
                        pinned: (key) => pinned(i, key),
                        repoint: (from, to) => repoint(i, from, to),
                        remove: (key) => togglePin(i, key),
                      },
                    ]
                  : [],
              )}
            />
          )}
          <div className={failed && !wholeTab ? "stale" : undefined}>
            <Pins.Provider
              value={{ pinned, toggle: togglePin, status: pinStatus }}
            >
              {results}
            </Pins.Provider>
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
                onSettle={(path, value, on) => settle(open.i, path, value, on)}
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
      {saving && (
        <SaveDialog
          tests={tests}
          opened={
            opened && {
              name: opened.name,
              file: opened.file,
              labels: opened.chosen.map((i) => opened.file.tests[i]!.label),
            }
          }
          onSaved={(name) =>
            setToast({
              id: Date.now(),
              node: (
                <>
                  Download started: <code>{name}</code>
                </>
              ),
            })
          }
          onClose={() => setSaving(false)}
        />
      )}
      {share && (
        <ShareDialog
          url={share.url}
          reference={
            origin === "imported" && edited
              ? `${imported!.owner}/${imported!.repo}@${imported!.sha.slice(0, 7)}`
              : undefined
          }
          pins={pinCount > 0}
          onCopied={() => setToast({ id: Date.now(), node: "Link copied" })}
          onClose={() => setShare(undefined)}
        />
      )}
      {invalidTest && (
        <InvalidTestDialog
          {...invalidTest}
          onClose={() => setInvalidTest(undefined)}
        />
      )}
      {choosing && (
        <TestPicker
          name={choosing.name}
          file={choosing.file}
          onPick={(chosen) =>
            openTests(choosing.name, choosing.text, choosing.file, chosen)
          }
          onClose={() => setChoosing(undefined)}
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

/** An Assumption key moved onto another job: `file › job`, then an output's path if it has one. */
const onJob = (key: string, job: string) =>
  [job, ...key.split(" › ").slice(2)].join(" › ");

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
