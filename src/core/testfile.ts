// Test files (#10, ADR 0002): parsing, validation, pin comparison and writing, shared by the
// CLI and the playground, so no Node APIs.
import {
  Document,
  LineCounter,
  isMap,
  isScalar,
  parseDocument,
  stringify,
  type Node,
  type YAMLMap,
} from "yaml";
import { isAccess } from "./access";
import { isCheck } from "./checks";
import { isConcurrency } from "./concurrency";
import type { Pin, Test, TestFile } from "./generated/test-file";
import validate from "./generated/validate-test-file";
import type { SimulationResult, Verdict } from "./index";
import { withDefaults, type Scenario } from "./scenario";

export type { Pin, Test, TestFile } from "./generated/test-file";

interface ValidateFn {
  (value: unknown): boolean;
  errors?:
    | {
        instancePath: string;
        keyword: string;
        params: { additionalProperty?: string };
        message?: string;
      }[]
    | null;
}

/**
 * One loader per Test file `version`, each returning the file in the current shape, so a
 * change to the Scenario shape never stops an older Test file loading (ADR 0002).
 */
const LOADERS: Record<number, (file: unknown) => unknown> = {
  1: (file) => file,
};

const STRINGS = "quote it: GitHub variables and job outputs are always strings";
// The playground's owner/repo check says the same (#12 addendum B).
const OWNER_REPO = "use the form owner/repo, e.g. acme/app";

/**
 * Parses a Test file with the YAML 1.2 core schema and validates it against
 * `schemas/test-file.schema.json`. Each error reads `file:line: message` (#10 §1–2).
 */
export function parseTestFile(
  path: string,
  text: string,
): { file: TestFile; errors?: never } | { file?: never; errors: string[] } {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, {
    lineCounter,
    prettyErrors: false,
    version: "1.2",
    schema: "core",
  });
  const at = (offset: number) => `${path}:${lineCounter.linePos(offset).line}`;
  if (doc.errors.length > 0)
    return { errors: doc.errors.map((e) => `${at(e.pos[0])}: ${e.message}`) };
  // The line of the deepest node on the path that the file has.
  const lineOf = (segs: unknown[]): string => {
    for (let n = segs.length; n >= 0; n--) {
      const node = doc.getIn(segs.slice(0, n), true) as {
        range?: [number];
      } | null;
      if (node?.range) return at(node.range[0]);
    }
    return `${path}:1`;
  };

  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: 1000 });
  } catch (err) {
    return { errors: [`${path}:1: ${(err as Error).message}`] };
  }
  const version =
    typeof data === "object" && data !== null && Object.hasOwn(data, "version")
      ? (data as { version: unknown }).version
      : undefined;
  const load =
    typeof version === "number" && Object.hasOwn(LOADERS, version)
      ? LOADERS[version]!
      : undefined;
  if (version !== undefined && !load)
    return {
      errors: [
        `${lineOf(["version"])}: version ${JSON.stringify(version)} isn't supported: this WhyNoRun reads Test file version 1`,
      ],
    };
  const file = load ? load(data) : data;

  const check = validate as ValidateFn;
  if (!check(file))
    return {
      errors: (check.errors ?? []).map((e) => {
        const segs = e.instancePath
          .split("/")
          .slice(1)
          .map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"));
        const extra = e.params.additionalProperty;
        if (extra !== undefined) segs.push(extra);
        const where =
          extra === undefined ? e.instancePath : `${e.instancePath}/${extra}`;
        const message =
          e.keyword === "type" &&
          /^\/tests\/\d+\/scenario\/(repo\/vars|assume)\/[^/]+$/.test(
            e.instancePath,
          )
            ? STRINGS
            : e.keyword === "pattern" &&
                e.instancePath.endsWith("/repo/repository")
              ? OWNER_REPO
              : (e.message ?? "is invalid");
        return `${lineOf(segs)}: ${where || "file"} ${message}`;
      }),
    };

  const valid = file as TestFile;
  const labels = new Set<string>();
  const errors = valid.tests.flatMap((t, i) => {
    if (!labels.has(t.label)) {
      labels.add(t.label);
      return [];
    }
    return [
      `${lineOf(["tests", i, "label"])}: label \`${t.label}\` is used by another test in this file`,
    ];
  });
  return errors.length > 0 ? { errors } : { file: valid };
}

/** A pinned field that differs: `pinned` is as written, `now` is the Verdict's, absent as undefined. */
export interface Change {
  field: keyof Pin;
  pinned: unknown;
  now: unknown;
}

/** What `whynorun test` reports for one test (#10 §3–4). */
export type Finding =
  | { status: "match"; key: string }
  | { status: "changed"; key: string; value: string; changes: Change[] }
  | { status: "pinned subject not found"; key: string; candidates: string[] }
  | { status: "assumed subject not found"; key: string; candidates: string[] }
  | { status: "file has Diagnostics"; file: string }
  | { status: "Scenario unsupported"; reason: string };

const FIELDS: readonly (keyof Pin)[] = [
  "value",
  "possible",
  "root",
  "group",
  "continuing",
];
const SETS = new Set<keyof Pin>(["possible", "continuing"]);

function current(verdict: Verdict, field: keyof Pin): unknown {
  if (field === "root") return verdict.causes[0]?.rule;
  return verdict[field];
}

function same(field: keyof Pin, pinned: unknown, now: unknown): boolean {
  if (SETS.has(field) && Array.isArray(pinned) && Array.isArray(now))
    return (
      JSON.stringify([...(pinned as string[])].sort()) ===
      JSON.stringify([...(now as string[])].sort())
    );
  // A pinned null means the Verdict must not have the field.
  return (pinned ?? undefined) === now;
}

/**
 * Compares one test's pins with the Verdicts of its Scenario. A missing pin field isn't
 * compared. A pin on a file with Diagnostics reports "file has Diagnostics" once per file,
 * and an unsupported Scenario is reported once, its `event` pin still compared (#10 §4).
 * Any Diagnostic fails the run too, whatever this returns.
 */
export function compareTest(test: Test, result: SimulationResult): Finding[] {
  const verdicts = new Map(result.verdicts.map((v) => [v.key, v]));
  const event = verdicts.get("event");
  const unsupported = event?.value === "unsupported";
  const broken = new Set(
    result.diagnostics.map((d) => d.path.slice(d.path.lastIndexOf("/") + 1)),
  );
  const findings: Finding[] = [];
  if (unsupported) {
    const inputs = event.causes[0]?.inputs ?? [];
    const reason = inputs
      .filter((i) => i.value !== undefined)
      .map((i) => `${i.path} = ${String(i.value)}`)
      .join(", ");
    findings.push({ status: "Scenario unsupported", reason });
  }
  const reported = new Set<string>();
  for (const [key, pin] of Object.entries(test.pins)) {
    const verdict = verdicts.get(key);
    if (verdict === undefined) {
      if (unsupported) continue;
      const file = key.split(" › ")[0]!;
      if (broken.has(file)) {
        if (!reported.has(file))
          findings.push({ status: "file has Diagnostics", file });
        reported.add(file);
        continue;
      }
      findings.push({
        status: "pinned subject not found",
        key,
        candidates: candidates(key, result.verdicts),
      });
      continue;
    }
    const changes = FIELDS.flatMap((field) => {
      if (!Object.hasOwn(pin, field)) return [];
      const now = current(verdict, field);
      return same(field, pin[field], now)
        ? []
        : [{ field, pinned: pin[field], now }];
    });
    findings.push(
      changes.length > 0
        ? { status: "changed", key, value: verdict.value, changes }
        : { status: "match", key },
    );
  }
  for (const { key, candidates } of result.unmatchedAssumptions)
    findings.push({ status: "assumed subject not found", key, candidates });
  return findings;
}

const kind = (key: string) =>
  [isAccess(key), isCheck(key), isConcurrency(key)].join();

// Subjects of the same kind one segment away from the pinned key, such as a renamed job (ADR 0001).
function candidates(key: string, verdicts: Verdict[]): string[] {
  const segs = key.split(" › ");
  return verdicts
    .map((v) => v.key)
    .filter((k) => {
      const other = k.split(" › ");
      return (
        other.length === segs.length &&
        kind(k) === kind(key) &&
        other.filter((s, i) => s !== segs[i]).length === 1
      );
    });
}

// An absent value shows as —, and a set in code-unit order (#10 §3).
export function shown(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (Array.isArray(value))
    return `{${[...(value as string[])].sort().join(", ")}}`;
  return String(value);
}

const withCandidates = (candidates: string[]) =>
  candidates.length > 0 ? ` (candidates: ${candidates.join(", ")})` : "";

/** One line of `whynorun test` output, such as `ci.yml › test › secrets: available → empty (root FK-0 → FK-2)`. */
export function findingText(finding: Finding): string {
  switch (finding.status) {
    case "match":
      return `${finding.key}: matches`;
    case "changed": {
      const value = finding.changes.find((c) => c.field === "value");
      const rest = finding.changes
        .filter((c) => c !== value)
        .map((c) => `${c.field} ${shown(c.pinned)} → ${shown(c.now)}`);
      const head = value
        ? `${shown(value.pinned)} → ${shown(value.now)}`
        : finding.value;
      return `${finding.key}: ${head}${rest.length > 0 ? ` (${rest.join("; ")})` : ""}`;
    }
    case "pinned subject not found":
    case "assumed subject not found":
      return `${finding.status}: ${finding.key}${withCandidates(finding.candidates)}`;
    case "file has Diagnostics":
      return `${finding.file}: file has Diagnostics`;
    case "Scenario unsupported":
      return `Scenario unsupported (root WN-3): ${finding.reason}`;
  }
}

/** The editor schema line every Test file the playground writes starts with, from 1.0.0 (#14 §1). */
export const SCHEMA_LINE =
  "# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/whynorun@1/schemas/test-file.schema.json";

/** A new pin: every field that applies, null where the Verdict has none (#10 §3). */
function pinOf(verdict: Verdict): Pin {
  const pin: Pin = {
    value: verdict.value,
    possible: verdict.possible ?? null,
    root: verdict.causes[0]?.rule ?? null,
  };
  if (isConcurrency(verdict.key)) {
    pin.group = verdict.group ?? null;
    pin.continuing = verdict.continuing ?? null;
  }
  return pin;
}

const OPTIONAL = new Set<keyof Pin>(["possible", "group", "continuing"]);

/**
 * `test --update`'s rule within one loaded pin (#10 §6): it keeps its own field list. A field
 * that matches stays as written; a changed one is rewritten, and `possible`, `group` and
 * `continuing` are dropped when the Verdict lacks them. They are added only when the pin moves
 * into a shape where they first apply (decided → Uncertain, `no-run` → `runs`), so a key the
 * Maintainer deleted is never re-added.
 */
export function updatePin(pin: Pin, verdict: Verdict): Pin {
  const was = pin.value;
  const next: Pin = {};
  for (const field of FIELDS) {
    const now = current(verdict, field);
    if (!Object.hasOwn(pin, field)) {
      const applies =
        field === "possible"
          ? was !== undefined &&
            was !== "uncertain" &&
            verdict.value === "uncertain"
          : was === "no-run" && verdict.value !== "no-run";
      if (OPTIONAL.has(field) && applies && now !== undefined)
        Object.assign(next, { [field]: now });
    } else if (same(field, pin[field], now))
      Object.assign(next, { [field]: pin[field] });
    else if (now !== undefined || !OPTIONAL.has(field))
      Object.assign(next, { [field]: now ?? null });
  }
  return next;
}

/** What stops `test --update` and Accept all writing anything: all or nothing (#10 §6). */
export const blocksUpdate = (finding: Finding): boolean =>
  finding.status !== "match" && finding.status !== "changed";

/** `test --update` for one test: each changed pin as {@link updatePin} rewrites it, by key. */
export function updatedPins(
  test: Test,
  result: SimulationResult,
): Record<string, Pin> {
  const verdicts = new Map(result.verdicts.map((v) => [v.key, v]));
  return Object.fromEntries(
    compareTest(test, result).flatMap((f) =>
      f.status === "changed"
        ? [[f.key, updatePin(test.pins[f.key]!, verdicts.get(f.key)!)]]
        : [],
    ),
  );
}

/**
 * `test --update` for one Test file (#10 §6): only its changed pins are rewritten, each edited
 * through the `yaml` Document API and spliced back over its own text, so comments and the rest
 * of the file stay byte for byte. `results` are its tests' simulations, in order. Undefined
 * when no pin changed. Callers check {@link blocksUpdate} across every file first, so nothing
 * is written when anything blocks.
 */
export function updateTestFile(
  text: string,
  file: TestFile,
  results: SimulationResult[],
): string | undefined {
  const doc = parseDocument(text, { version: "1.2", schema: "core" });
  const edits: { from: number; to: number; text: string }[] = [];
  file.tests.forEach((test, i) => {
    for (const [key, pin] of Object.entries(updatedPins(test, results[i]!))) {
      const at = doc.getIn(["tests", i, "pins", key], true) as Node;
      const [from, to] = at.range!;
      // An alias or the like is replaced by a flow map of its own.
      const node = isMap(at) ? at.clone() : (doc.createNode(pin) as YAMLMap);
      if (!isMap(at)) node.flow = true;
      const was = test.pins[key]!;
      for (const field of FIELDS) {
        const now = pin[field];
        if (!Object.hasOwn(pin, field)) node.delete(field);
        else if (Object.hasOwn(was, field) && same(field, was[field], now)) {
          // As written.
        } else {
          const old = node.get(field, true);
          // A scalar keeps its own comment and quoting.
          if (isScalar(old) && !Array.isArray(now)) old.value = now;
          else node.set(field, doc.createNode(now));
        }
      }
      // The comments around the pin stay in the text, outside its range.
      node.comment = node.commentBefore = undefined;
      const indent = from - (text.lastIndexOf("\n", from - 1) + 1);
      const written = new Document(node, { version: "1.2" })
        .toString({ lineWidth: 0 })
        .trimEnd()
        .replaceAll("\n", `\n${" ".repeat(indent)}`);
      const tail = /\s*$/.exec(text.slice(from, to))![0];
      edits.push({ from, to, text: written + tail });
    }
  });
  if (edits.length === 0) return undefined;
  return edits
    .sort((a, b) => b.from - a.from)
    .reduce((t, e) => t.slice(0, e.from) + e.text + t.slice(e.to), text);
}

/** A test to write: its pinned Verdicts, and the pins it was loaded with, if any. */
export interface TestToWrite {
  label: string;
  scenario: Scenario;
  pinned: Verdict[];
  /** Loaded pins keep their own field list, and one with no Verdict is written as loaded (#12 §9). */
  loaded?: Record<string, Pin>;
}

/**
 * Writes one Test file: `version: 1`, then one `{ label, scenario, pins }` entry per test,
 * each Scenario with every default written out so a later release can't change it (#10 §1–3).
 * Over an `opened` file, entries replace its tests by label and the others are kept as they
 * were parsed, in their order (#12 §9).
 */
export function writeTestFile(tests: TestToWrite[], opened?: TestFile): string {
  const entries = tests.map(({ label, scenario, pinned, loaded = {} }) => {
    const verdicts = new Map(pinned.map((v) => [v.key, v]));
    const keys = new Set([...Object.keys(loaded), ...verdicts.keys()]);
    return {
      label,
      // A plain copy: withDefaults keeps the Maintainer's maps null-prototype.
      scenario: JSON.parse(
        JSON.stringify(withDefaults(scenario).scenario),
      ) as Scenario,
      pins: Object.fromEntries(
        [...keys].map((key) => {
          const v = verdicts.get(key);
          const pin = Object.hasOwn(loaded, key) ? loaded[key] : undefined;
          return [key, pin ? (v ? updatePin(pin, v) : pin) : pinOf(v!)];
        }),
      ),
    };
  });
  const byLabel = new Map(entries.map((e) => [e.label, e]));
  const kept = (opened?.tests ?? []).map((t) => byLabel.get(t.label) ?? t);
  const file: TestFile = {
    version: 1,
    tests: [
      ...kept,
      ...entries.filter((e) => !kept.includes(e)),
    ] as TestFile["tests"],
  };
  // The YAML 1.2 core schema the loader reads with, so a string "true" stays quoted (#10 §1).
  return `${SCHEMA_LINE}\n${stringify(file, { version: "1.2", schema: "core", lineWidth: 0 })}`;
}
