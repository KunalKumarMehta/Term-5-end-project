// The draft (#14 §2–6, ADR 0004): one per-viewer copy of the playground in localStorage. Every
// page on the origin can write it, so it is untrusted input and is validated before it applies.
import {
  loadScenario,
  parseTestFile,
  validateScenario,
  type Pin,
  type Scenario,
  type TestFile,
  type WorkflowFile,
} from "../../src/core";
import type { Opened } from "./App";
import { isOwnerRepo } from "./Explanation";
import { GARBAGE } from "./ImportForm";
import type { Imported, ImportedFacts } from "./importRepo";
import { sourceOf, type Source } from "./RepoFacts";

export const KEY = "whynorun:draft:v1";
const KEYS = /^whynorun:draft:v(\d+)$/;

export const ANOTHER_VERSION =
  "A draft from another WhyNoRun version can't be opened here";

/** An import travels as its reference; the files are the draft's own (#14 §2). */
export type Origin =
  | "example"
  | "pasted"
  | "uploaded"
  | { owner: string; repo: string; ref: string; sha: string };

/** A Scenario as the playground holds it: unset fields stay unset, beside their source tags. */
export interface DraftScenario {
  label: string;
  scenario: Scenario;
  /** Each tagged field's source (#9 §6), so a reload keeps assumed, set and imported apart. */
  sources: Record<string, Source>;
  touched: boolean;
  /** The tray's pinned subject keys, in the order pinned. */
  pins: string[];
  /** Pins from the opened Test file, each with its own field list. */
  loaded?: Record<string, Pin>;
}

export interface Draft {
  /** The Test file `version` the Scenarios are in, for ADR 0002's loaders (#14 §5). */
  version: number;
  saved: string;
  set: {
    files: WorkflowFile[];
    origin?: Origin;
    edited: boolean;
    /** The example's, upload's or import's files, so Reset works offline. */
    originals?: WorkflowFile[];
  };
  scenarios: DraftScenario[];
  /** The opened Test file's name and text: its unopened tests stay verbatim. */
  opened?: { name: string; text: string; chosen: number[] };
}

/** What the playground holds that the draft keeps. */
export interface Held {
  files: WorkflowFile[];
  origin?: "example" | "pasted" | "uploaded" | "imported";
  imported?: Imported;
  base?: readonly WorkflowFile[];
  edited: boolean;
  scenarios: Scenario[];
  labels: string[];
  pins: string[][];
  touched: boolean;
  opened?: Opened;
}

// The fields with a source tag (#9 §6), and those an import fills.
const TAGGED = [
  "repo.visibility",
  "repo.predates",
  "repo.defaultBranch",
  "repo.tokenDefault",
  "repo.eventPolicy",
  "repo.repository",
  "event.approval",
];
const FACTS: (keyof ImportedFacts)[] = [
  "visibility",
  "predates",
  "defaultBranch",
  "repository",
];

/** The draft for what the playground holds, or undefined when it holds nothing. */
export function toDraft(held: Held, saved: Date): Draft | undefined {
  const { files, origin, imported, base, scenarios, labels, pins, opened } =
    held;
  if (
    files.length === 0 &&
    !held.touched &&
    scenarios.length === 1 &&
    pins.flat().length === 0 &&
    !opened
  )
    return;
  return {
    version: 1,
    saved: saved.toISOString(),
    set: {
      files,
      origin:
        origin === "imported"
          ? {
              owner: imported!.owner,
              repo: imported!.repo,
              ref: imported!.ref,
              sha: imported!.sha,
            }
          : origin,
      edited: held.edited,
      originals: base && [...base],
    },
    scenarios: scenarios.map((scenario, i) => ({
      label: labels[i]!,
      scenario,
      sources: Object.fromEntries(
        TAGGED.flatMap((path) => {
          const source = sourceOf(scenario, path, imported?.facts);
          return source ? [[path, source]] : [];
        }),
      ),
      // Only Scenario 1's is tracked; a second Scenario exists because Compare was turned on.
      touched: i === 0 ? held.touched : true,
      pins: pins[i] ?? [],
      loaded: opened?.loaded[i],
    })),
    opened: opened && {
      name: opened.name,
      text: opened.text,
      chosen: opened.chosen,
    },
  };
}

/** Back to what the playground holds. Restored Scenarios count as touched (#14 §3). */
function fromDraft(draft: Draft, file?: TestFile): Held {
  const { files, origin, edited, originals } = draft.set;
  // The form keeps a missing date as an empty field (#12 §3, #14 §6.4).
  const scenarios = draft.scenarios.map(({ scenario: s }) =>
    s.repo.date === undefined ? { ...s, repo: { ...s.repo, date: "" } } : s,
  );
  const facts: Partial<ImportedFacts> = {};
  for (const field of FACTS) {
    const i = draft.scenarios.findIndex(
      (s) => s.sources[`repo.${field}`] === "imported",
    );
    if (i >= 0) Object.assign(facts, { [field]: scenarios[i]!.repo[field] });
  }
  const tests = draft.opened?.chosen.map((c) => file!.tests[c]!);
  return {
    files,
    origin: typeof origin === "object" ? "imported" : origin,
    imported:
      typeof origin === "object"
        ? {
            owner: origin.owner,
            repo: origin.repo,
            ref: origin.ref,
            sha: origin.sha,
            files: originals ?? files,
            ignored: [],
            facts: facts as ImportedFacts,
          }
        : undefined,
    base: originals,
    edited,
    scenarios,
    labels: draft.scenarios.map((s) => s.label),
    pins: draft.scenarios.map((s) => s.pins),
    touched: true,
    opened: draft.opened &&
      tests && {
        ...draft.opened,
        file: file!,
        // As opened: the restored Scenarios count as changed since (#14 §3).
        scenarios: tests.map((t) => t.scenario),
        keys: tests.map((t) => Object.keys(t.pins)),
        loaded: draft.scenarios.map((s) => s.loaded ?? {}),
      },
  };
}

/** A field that failed the checks, named without its value (#14 §6.4). */
class Invalid extends Error {}

const bad = (field: string): never => {
  throw new Invalid(field);
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown, max = Infinity): v is string =>
  typeof v === "string" && v.length <= max;
const strings = (v: unknown) =>
  v === null || (Array.isArray(v) && v.every((s) => isString(s)));

// #14 §6.4's limits.
const MAX_FILES = 100;
const MAX_TEXT = 256 * 1024;
const MAX_KEY = 300;
const PATH = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const SHA = /^[0-9a-f]{40}$/;
const PIN: Record<string, (v: unknown) => boolean> = {
  value: (v) => isString(v),
  possible: strings,
  root: (v) => v === null || isString(v),
  group: (v) => v === null || isString(v),
  continuing: strings,
};

function checkFiles(files: unknown, at: string) {
  if (!Array.isArray(files) || files.length > MAX_FILES) bad(at);
  const paths = new Set<string>();
  (files as unknown[]).forEach((f, i) => {
    if (!isObject(f)) bad(`${at}[${i}]`);
    const { path, text } = f as Record<string, unknown>;
    if (!isString(path) || !PATH.test(path) || paths.has(path))
      bad(`${at}[${i}].path`);
    if (!isString(text, MAX_TEXT)) bad(`${at}[${i}].text`);
    paths.add(path as string);
  });
}

function checkOrigin(origin: unknown) {
  if (origin === undefined) return;
  if (!isObject(origin)) {
    if (!["example", "pasted", "uploaded"].includes(origin as string))
      bad("set.origin");
    return;
  }
  const { owner, repo, ref, sha } = origin;
  if (!isString(owner) || !isString(repo) || !isOwnerRepo(`${owner}/${repo}`))
    bad("set.origin owner/repo");
  if (!isString(ref, 255) || ref === "" || GARBAGE.test(ref))
    bad("set.origin.ref");
  if (!isString(sha) || !SHA.test(sha)) bad("set.origin.sha");
}

/** The form's Scenario as the schema reads it: the date may be empty or absent (#14 §6.4). */
function probe(s: unknown): unknown {
  if (!isObject(s) || !isObject(s.repo)) return s;
  return s.repo.date === undefined || s.repo.date === ""
    ? { ...s, repo: { ...s.repo, date: "2000-01-01" } }
    : s;
}

function checkScenario(
  s: unknown,
  i: number,
  version: unknown,
  imported: boolean,
  labels: Set<string>,
): DraftScenario {
  const at = `scenarios[${i}]`;
  if (!isObject(s)) return bad(at);
  const { label, sources, touched, pins, loaded } = s;
  if (!isString(label, 100) || label.trim() === "" || labels.has(label))
    bad(`${at}.label`);
  labels.add(label as string);
  const scenario = loadScenario(version, s.scenario);
  const problems = validateScenario(probe(scenario));
  if (problems.length > 0) bad(`${at}.scenario${problems[0]!}`);
  if (
    !isObject(sources) ||
    !Object.entries(sources).every(
      ([path, source]) =>
        TAGGED.includes(path) &&
        (source === "assumed" ||
          source === "set" ||
          (source === "imported" && imported)),
    )
  )
    bad(`${at}.sources`);
  if (typeof touched !== "boolean") bad(`${at}.touched`);
  if (!Array.isArray(pins) || !pins.every((k) => isString(k, MAX_KEY)))
    bad(`${at}.pins`);
  if (
    loaded !== undefined &&
    !(
      isObject(loaded) &&
      Object.entries(loaded).every(
        ([key, pin]) =>
          key.length <= MAX_KEY &&
          isObject(pin) &&
          Object.entries(pin).every(
            ([field, v]) => Object.hasOwn(PIN, field) && PIN[field]!(v),
          ),
      )
    )
  )
    bad(`${at}.loaded`);
  return { ...(s as unknown as DraftScenario), scenario: scenario as Scenario };
}

/**
 * #14 §6.4: the field checks a draft passes before anything applies. On a failure nothing
 * loads, and the reason names the field without repeating its value.
 */
export function validateDraft(
  data: unknown,
): { draft: Draft; file?: TestFile; error?: never } | { error: string } {
  try {
    if (!isObject(data)) return bad("draft");
    if (loadScenario(data.version, null) === undefined)
      return { error: ANOTHER_VERSION };
    if (!isString(data.saved) || Number.isNaN(Date.parse(data.saved)))
      bad("saved");
    const set = isObject(data.set) ? data.set : bad("set");
    checkFiles(set.files, "set.files");
    if (set.originals !== undefined) checkFiles(set.originals, "set.originals");
    if (typeof set.edited !== "boolean") bad("set.edited");
    checkOrigin(set.origin);
    if (
      !Array.isArray(data.scenarios) ||
      data.scenarios.length < 1 ||
      data.scenarios.length > 2
    )
      bad("scenarios");
    const labels = new Set<string>();
    const scenarios = (data.scenarios as unknown[]).map((s, i) =>
      checkScenario(s, i, data.version, isObject(set.origin), labels),
    );
    let file: TestFile | undefined;
    const { opened } = data;
    if (opened !== undefined) {
      if (!isObject(opened)) return bad("opened");
      const { name, text, chosen } = opened;
      if (!isString(name, 255) || name === "") bad("opened.name");
      if (!isString(text, MAX_TEXT)) bad("opened.text");
      const parsed = parseTestFile(name as string, text as string);
      if (parsed.errors) bad("opened.text");
      file = parsed.file!;
      if (
        !Array.isArray(chosen) ||
        chosen.length < scenarios.length ||
        chosen.length > 2 ||
        new Set(chosen).size !== chosen.length ||
        !chosen.every(
          (c) => Number.isInteger(c) && c >= 0 && c < file!.tests.length,
        )
      )
        bad("opened.chosen");
    }
    return { draft: { ...(data as unknown as Draft), scenarios }, file };
  } catch (e) {
    if (e instanceof Invalid) return { error: `${e.message} is invalid` };
    throw e;
  }
}

/** What a page load finds: a draft to restore, one that can't be opened, or nothing. */
export interface Boot {
  held?: Held;
  saved?: Date;
  unreadable?: { key: string; raw: string; reason: string };
}

/** Reads the draft at load. Storage that can't be read is the same as no draft. */
export function readDraft(): Boot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      // An older or newer key: offered as a download, never opened (#14 §5).
      const other = Object.keys(localStorage).find((k) => KEYS.test(k));
      return other
        ? {
            unreadable: {
              key: other,
              raw: localStorage.getItem(other) ?? "",
              reason: ANOTHER_VERSION,
            },
          }
        : {};
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return { unreadable: { key: KEY, raw, reason: ANOTHER_VERSION } };
    }
    const checked = validateDraft(data);
    if (checked.error !== undefined)
      return {
        unreadable: {
          key: KEY,
          raw,
          reason:
            checked.error === ANOTHER_VERSION
              ? ANOTHER_VERSION
              : `The saved draft can't be opened: ${checked.error}`,
        },
      };
    return {
      held: fromDraft(checked.draft, checked.file),
      saved: new Date(checked.draft.saved),
    };
  } catch {
    return {};
  }
}

/**
 * Writes the draft, or deletes it when there's none. A write that throws (blocked, private
 * mode or quota) deletes the stored one too, so a reload can't bring back older work (#14 §4).
 */
export function writeDraft(draft: Draft | undefined): boolean {
  try {
    if (draft) localStorage.setItem(KEY, JSON.stringify(draft));
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Storage refuses even that: there's nothing a reload could bring back.
    }
    return false;
  }
}

/** Discards an unreadable draft; a newer version's key is never touched (#14 §5). */
export function discardDraft(key: string) {
  if (Number(KEYS.exec(key)?.[1]) > 1) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to discard where storage is blocked.
  }
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const pad = (n: number) => String(n).padStart(2, "0");

/** "28 Oct 14:02", in the Maintainer's local time (#14 §4). */
export const when = (d: Date) =>
  `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
