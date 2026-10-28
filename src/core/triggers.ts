// Whether an Event creates a run of one GitHub workflow: `on:` (EV-0), activity types
// (EV-1, EV-4), branch and tag filters (BR-1..8, GL-1..6), path filters (PA-1..7, BR-6) and
// commit-message skips (SK-1), read from the pushed commit or the merge commit (DB-2, DB-3).
// How the branch and tag filters combine follows Gitea's
// Actions workflow detector (MIT, go-gitea/gitea modules/actions/workflows.go): a push is
// tried only against the filters of its own ref kind, and a pull request against its base.
import type { Cause, Verdict } from "./index";
import type { Diagnostic, ParsedWorkflow, Span } from "./parser";
import type { Event } from "./scenario";
import {
  compilePattern,
  compilePatterns,
  filter,
  skip,
  type Decision,
} from "./workflowpattern";

type Settings = Record<string, unknown>;

const KINDS = ["branches", "tags"] as const;
const SKIP =
  /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]|\n\n\nskip-checks: ?true\s*$/;
// GitHub reads only the first 3,000 changed files (PA-5).
const DIFF_LIMIT = 3000;
const GLOBS = [
  ["GL-1", /\*/],
  ["GL-2", /.[?+]/],
  ["GL-3", /\[/],
  ["GL-4", /^!|\\/],
] as const;

/** The glob features the deciding pattern uses, at its position. */
const globCauses = (pattern: string, spans: Span[]): Cause[] =>
  GLOBS.filter(([, re]) => re.test(pattern)).map(([rule]) => ({
    rule,
    spans,
    inputs: [],
  }));
const PR_DEFAULT_TYPES = ["opened", "synchronize", "reopened"];

const settingsOf = (parsed: ParsedWorkflow, event: string): Settings => {
  const value = (parsed.events as Record<string, unknown>)[event];
  return typeof value === "object" && value !== null ? (value as Settings) : {};
};

/** The branch and tag filter problems that make GitHub reject the file. */
export function filterDiagnostics(parsed: ParsedWorkflow): Diagnostic[] {
  const found: Diagnostic[] = [];
  for (const event of Object.keys(parsed.events)) {
    const at = (key: string): Span =>
      parsed.onEntries.get(key) ??
      parsed.onEntries.get(event) ??
      parsed.onSpan!;
    const settings = settingsOf(parsed, event);
    for (const kind of [...KINDS, "paths"]) {
      const ignore = `${kind}-ignore`;
      if (Object.hasOwn(settings, kind) && Object.hasOwn(settings, ignore))
        found.push({
          ...at(`${event}.${ignore}`),
          rule: kind === "paths" ? "PA-1" : "BR-1",
          message: `you may only define one of \`${kind}\` and \`${ignore}\` for a single event`,
        });
      for (const key of [kind, ignore]) {
        const list = settings[key];
        if (!Array.isArray(list)) continue;
        list.forEach((pattern, i) => {
          try {
            compilePattern(String(pattern));
          } catch (err) {
            found.push({
              ...at(`${event}.${key}.${i}`),
              message: (err as Error).message,
            });
          }
        });
      }
    }
  }
  return found;
}

/** The Verdict of one readable GitHub workflow for a supported Event, without its key. */
export function trigger(
  parsed: ParsedWorkflow,
  event: Event,
  defaultBranch: string,
): Omit<Verdict, "key"> {
  const decided = byRef(parsed, event, defaultBranch);
  if (decided.value === "skipped") return decided;
  const result = byPaths(parsed, event, decided);
  // SK-1: the head commit's message skips a push or pull_request run.
  const message = event.message;
  if (
    result.value === "skipped" ||
    message === undefined ||
    !SKIP.test(message)
  )
    return result;
  const entry = parsed.onEntries.get(event.name);
  return {
    value: "skipped",
    causes: [
      {
        rule: "SK-1",
        spans: entry ? [entry] : [],
        inputs: [{ path: "event.message", value: message }],
      },
      ...result.causes,
    ],
  };
}

/** Path filters (PA-2..7), which must pass as well as a branch or tag filter (BR-6). */
function byPaths(
  parsed: ParsedWorkflow,
  event: Event,
  decided: Omit<Verdict, "key">,
): Omit<Verdict, "key"> {
  const name = event.name;
  const settings = settingsOf(parsed, name);
  const has = (key: string) => Object.hasOwn(settings, key);
  const key = has("paths") ? "paths" : "paths-ignore";
  const list = settings[key];
  // As in act, an empty list filters nothing.
  if (!Array.isArray(list) || list.length === 0) return decided;
  const patterns = list.map(String);
  const spans = (at: string): Span[] => {
    const span = parsed.onEntries.get(`${name}.${at}`);
    return span ? [span] : [];
  };
  const keySpans = spans(key);
  const include = key === "paths";

  // PA-6: path filters aren't evaluated for a tag push.
  const ref = event.ref ?? "";
  if (name === "push" && ref.startsWith("refs/tags/")) {
    const tagged: Cause = {
      rule: "PA-6",
      spans: keySpans,
      inputs: [{ path: "event.ref", value: ref }],
    };
    if (include && !has("tags") && !has("tags-ignore"))
      return {
        value: "uncertain",
        causes: [tagged, ...decided.causes],
        possible: ["runs", "skipped"],
        settle: [],
      };
    return { ...decided, causes: [...decided.causes, tagged] };
  }

  const changed = event.changed ?? [];
  const input = { path: "event.changed", value: changed };
  const filtered = KINDS.some((k) => has(k) || has(`${k}-ignore`));
  const combine = (value: string, own: Cause[]): Omit<Verdict, "key"> => {
    const both: Cause[] = filtered
      ? [own[0]!, { rule: "BR-6", spans: [], inputs: [] }, ...own.slice(1)]
      : own;
    if (value === "uncertain")
      return {
        value,
        causes: [...both, ...decided.causes],
        possible: ["runs", "skipped"],
        settle: [],
      };
    // A branch filter's own uncertainty stands when the paths pass.
    if (value === "runs" && decided.value === "uncertain")
      return { ...decided, causes: [...decided.causes, ...both] };
    return { value, causes: [...both, ...decided.causes] };
  };
  if (changed.length === 0)
    return combine("skipped", [
      { rule: "PA-3", spans: keySpans, inputs: [input] },
    ]);
  // PA-5: the docs don't say whether paths-ignore checks only the first 3,000 files.
  if (!include && changed.length > DIFF_LIMIT)
    return combine("uncertain", [
      { rule: "PA-5", spans: keySpans, inputs: [input] },
    ]);

  const compiled = compilePatterns(patterns);
  const kept = (file: string) =>
    !(include ? skip : filter)(compiled, file).skip;
  const deciding = changed.slice(0, DIFF_LIMIT).find(kept);
  const by =
    deciding === undefined || !include ? -1 : skip(compiled, deciding).by;
  const at = by >= 0 ? spans(`${key}.${by}`) : keySpans;
  const own: Cause[] = [
    { rule: "PA-2", spans: at, inputs: [input] },
    { rule: "PA-7", spans: [], inputs: [] },
    ...(by >= 0 ? globCauses(patterns[by]!, at) : []),
  ];
  if (deciding !== undefined) return combine("runs", own);
  // PA-5: a match only after the first 3,000 files doesn't run it.
  if (changed.slice(DIFF_LIMIT).some(kept))
    own.unshift({ rule: "PA-5", spans: keySpans, inputs: [input] });
  return combine("skipped", own);
}

function byRef(
  parsed: ParsedWorkflow,
  event: Event,
  defaultBranch: string,
): Omit<Verdict, "key"> {
  const name = event.name;
  const spans = (key: string): Span[] => {
    const span = parsed.onEntries.get(key);
    return span ? [span] : [];
  };
  const named = { path: "event.name", value: name };
  if (!Object.hasOwn(parsed.events, name))
    return {
      value: "skipped",
      causes: [
        {
          rule: "EV-0",
          spans: parsed.onSpan ? [parsed.onSpan] : [],
          inputs: [named],
        },
      ],
    };

  const settings = settingsOf(parsed, name);
  const has = (key: string) => Object.hasOwn(settings, key);
  const listed: Cause = { rule: "EV-0", spans: spans(name), inputs: [named] };
  const after: Cause[] = [];

  // EV-1: the activity type; an unset one (in the Event or the file) is GitHub's defaults.
  if (name === "pull_request") {
    const types =
      Array.isArray(settings.types) && settings.types.length > 0
        ? settings.types.map(String)
        : PR_DEFAULT_TYPES;
    const wanted = event.type === undefined ? PR_DEFAULT_TYPES : [event.type];
    const typed: Cause = {
      rule: "EV-1",
      spans: spans(has("types") ? `${name}.types` : name),
      inputs:
        event.type === undefined
          ? []
          : [{ path: "event.type", value: event.type }],
    };
    if (!wanted.some((t) => types.includes(t)))
      return { value: "skipped", causes: [typed] };
    after.push(typed);
    if (event.type === "stacked")
      after.push({ ...typed, rule: "EV-4", spans: spans(`${name}.types`) });
  }
  after.push({
    rule: name === "push" ? "DB-2" : "DB-3",
    spans: [],
    inputs: [named],
  });

  // The ref a filter is tried against: the pushed ref (BR-3) or the base branch (BR-2).
  const given = name === "push" ? event.ref : event.base;
  const input =
    given === undefined
      ? { path: "repo.defaultBranch", value: defaultBranch }
      : { path: name === "push" ? "event.ref" : "event.base", value: given };
  const ref = given ?? `refs/heads/${defaultBranch}`;
  const kind =
    name === "push" && ref.startsWith("refs/tags/") ? "tags" : "branches";
  const short = ref.replace(/^refs\/(heads|tags)\//, "");
  const other = kind === "branches" ? "tags" : "branches";

  const include = has(kind);
  if (!include && !has(`${kind}-ignore`)) {
    // BR-3: a push with filters only for the other ref kind doesn't run.
    const otherKey = has(other) ? other : `${other}-ignore`;
    if (name === "push" && has(otherKey))
      return {
        value: "skipped",
        causes: [
          { rule: "BR-3", spans: spans(`push.${otherKey}`), inputs: [input] },
          ...after,
        ],
      };
    return { value: "runs", causes: [listed, ...after] };
  }

  const key = include ? kind : `${kind}-ignore`;
  const patterns = (settings[key] as unknown[]).map(String);
  const decide = (list: string[], flags = ""): Decision =>
    (include ? skip : filter)(compilePatterns(list, flags), short);
  const base = decide(patterns);
  const at = (i: number) =>
    spans(i >= 0 ? `${name}.${key}.${i}` : `${name}.${key}`);
  const matched: Cause = {
    rule: name === "push" ? "BR-3" : "BR-2",
    spans: spans(`${name}.${key}`),
    inputs: [input],
  };

  // BR-8: a full-ref pattern may or may not match; GL-6: case may or may not matter.
  const prefix = `refs/${kind === "tags" ? "tags" : "heads"}/`;
  const fullRef = patterns.findIndex((p) =>
    p.replace(/^!/, "").startsWith(prefix),
  );
  const uncertain = (rule: string, i: number): Omit<Verdict, "key"> => ({
    value: "uncertain",
    causes: [{ rule, spans: at(i), inputs: [input] }, matched, ...after],
    possible: ["runs", "skipped"],
    settle: [],
  });
  if (fullRef >= 0) {
    const asFull = decide(
      patterns.map((p) => p.replace(new RegExp(`^(!?)${prefix}`), "$1")),
    );
    if (asFull.skip !== base.skip) return uncertain("BR-8", fullRef);
  }
  const anyCase = decide(patterns, "i");
  if (anyCase.skip !== base.skip)
    return uncertain("GL-6", anyCase.by >= 0 ? anyCase.by : base.by);

  return {
    value: base.skip ? "skipped" : "runs",
    causes: [
      { rule: include ? "BR-4" : "BR-5", spans: at(base.by), inputs: [input] },
      matched,
      ...globCauses(patterns[base.by] ?? "", at(base.by)),
      ...after,
    ],
  };
}
