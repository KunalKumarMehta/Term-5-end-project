// Whether an Event creates a run of one GitHub workflow: `on:` (EV-0), activity types
// (EV-1, EV-4), and branch and tag filters (BR-1..8, GL-1..6), read from the pushed commit
// or the merge commit (DB-2, DB-3). How the branch and tag filters combine follows Gitea's
// Actions workflow detector (MIT, go-gitea/gitea modules/actions/workflows.go): a push is
// tried only against the filters of its own ref kind, and a pull request against its base.
import type { Cause, Diagnostic, Verdict } from "./index";
import type { ParsedWorkflow, Span } from "./parser";
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
const PR_DEFAULT_TYPES = ["opened", "synchronize", "reopened"];

const settingsOf = (parsed: ParsedWorkflow, event: string): Settings => {
  const value = (parsed.events as Record<string, unknown>)[event];
  return typeof value === "object" && value !== null ? (value as Settings) : {};
};

/** The branch and tag filter problems that make GitHub reject the file. */
export function filterDiagnostics(
  path: string,
  parsed: ParsedWorkflow,
): Diagnostic[] {
  const at = (key: string): Span =>
    parsed.onEntries.get(key) ??
    parsed.onSpan ?? { path, line: 1, col: 1, endLine: 1, endCol: 1 };
  const found: Diagnostic[] = [];
  for (const event of Object.keys(parsed.events)) {
    const settings = settingsOf(parsed, event);
    for (const kind of KINDS) {
      const ignore = `${kind}-ignore`;
      if (Object.hasOwn(settings, kind) && Object.hasOwn(settings, ignore))
        found.push({
          rule: "BR-1",
          span: at(`${event}.${ignore}`),
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
              span: at(`${event}.${key}.${i}`),
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

  const deciding = patterns[base.by] ?? "";
  const glob = [
    ["GL-1", /\*/],
    ["GL-2", /.[?+]/],
    ["GL-3", /\[/],
    ["GL-4", /^!|\\/],
  ] as const;
  return {
    value: base.skip ? "skipped" : "runs",
    causes: [
      { rule: include ? "BR-4" : "BR-5", spans: at(base.by), inputs: [input] },
      matched,
      ...glob
        .filter(([, re]) => re.test(deciding))
        .map(([rule]) => ({ rule, spans: at(base.by), inputs: [] })),
      ...after,
    ],
  };
}
