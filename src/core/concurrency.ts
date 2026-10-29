// The Concurrency outcome (#5 core flow 3, #76, #77): run A of the Scenario's Event and run B
// of its Follow-up event, keyed `<file or job key> › concurrency.A` / `.B` (#6). Every item of
// either run that may share a group is weighed: CC-1..CC-9, CC-11 and CC-12, and Uncertain
// where GitHub documents no answer.
import type { Cause, SettleHint, Verdict } from "./index";
import { githubContext, readGithub } from "./jobs";
import {
  RuntimeValueNeeded,
  evaluateCondition,
  evaluateTemplate,
  evaluateValue,
  type Concurrency,
  type Diagnostic,
  type ParsedWorkflow,
  type Resolve,
  type Span,
} from "./parser";
import { FROM_EVENT, settleable, type Scenario } from "./scenario";

/** Whether a Verdict key is a run of a concurrency pair. */
export const isConcurrency = (key: string): boolean =>
  / › concurrency\.[AB]$/.test(key);

/**
 * `queue: max` with `cancel-in-progress: true`, which GitHub rejects and the parser doesn't
 * flag (CC-3, #2): a Diagnostic on the `queue:` line in GitHub's own words.
 */
export function queueDiagnostics(parsed: ParsedWorkflow): Diagnostic[] {
  return [
    parsed.concurrency,
    ...[...parsed.jobSpans.values()].map((j) => j.concurrency),
  ].flatMap((c) =>
    c?.queue?.value === "max" && c.cancel?.value === true
      ? [
          {
            ...c.queue.span,
            rule: "CC-3",
            message:
              "The combination of `queue: max` and `cancel-in-progress: true` is not allowed and will result in a workflow validation error.",
          },
        ]
      : [],
  );
}

/** One run of the pair: its Scenario, with the run or job Verdict that creates its item. */
export interface Run {
  scenario: Scenario;
  verdict: Verdict;
}

/** One `concurrency:` declared, with the run A and run B that create its items. */
export interface Declaration {
  /** `<file or job key> › `; a local callee's is `<callerFile> › <callerJob>/ › `. */
  prefix: string;
  declared: Concurrency;
  /** The file it is written in: a pair from two files follows CC-12. */
  file: string;
  /** The calling file it runs in: its own, or a local callee's caller. */
  tree: string;
  /** In the calling file, the job that declares it; undefined at workflow level. */
  job?: string;
  /** In a local callee, the caller job that runs it (CC-7). */
  callee?: string;
  /** What `github.workflow` reads: the caller's `name:` or path, for a callee too (CC-7). */
  workflow: string;
  /** A callee's `inputs` context. */
  inputs?: Map<string, unknown>;
  /** Declared on a matrix job: one item per leg, which isn't expanded (#6). */
  matrix: boolean;
  /** Run A's jobs that keep running when the run is cancelled (CC-9). */
  survivors: string[];
  a: Run;
  b?: Run;
}

/** What one item reads: whether it is created, its group, its cancel and queue settings. */
interface Side {
  d: Declaration;
  run: Run;
  label: "A" | "B";
  created: boolean | undefined;
  /** As resolved, before lower-casing; undefined while it reads a value the Scenario lacks. */
  group: string | undefined;
  cancel: boolean | undefined;
  queue: "single" | "max";
  /** The values the Scenario lacks, in the order they were read, each where it is read. */
  needed: { path: string; span: Span }[];
  /** Whether the group read a property the Event leaves undefined (CC-5). */
  empty: boolean;
  /** Whether the group reads `matrix` or `strategy`, so each leg has its own (CC-5). */
  readsMatrix: boolean;
  /** Why GitHub's docs can't tell what this item does: approval (FK-4) or a matrix (CC-5, CC-6). */
  doubt?: Cause[];
}

/** One branch's outcome; `uncertain` here is a gap in GitHub's docs, not a missing value. */
type Outcome = Pick<Verdict, "value" | "causes" | "possible" | "continuing">;

interface World {
  created: Map<Side, boolean>;
  collide: Map<Side, boolean>;
  cancel: Map<Side, boolean>;
}

// GitHub creates a run that fails, so it holds its group; other values create no item.
const CREATED = new Set(["runs", "fails"]);
const QUEUE_MAX = 100;

/** Every `concurrency.A` and `.B` Verdict of the Workflow set, each item against the others. */
export function concurrencyVerdicts(all: Declaration[]): Verdict[] {
  const sides = all.flatMap((d) => [
    side(d, d.a, "A"),
    ...(d.b ? [side(d, d.b, "B")] : []),
  ]);
  const followUp = all[0]?.a.scenario.followUp;
  const state = followUp?.runA ?? "in-progress";
  const waiting = state === "pending";
  const runA = { path: "followUp.runA", value: state };
  const queued = { path: "followUp.pendingRuns", value: followUp?.pendingRuns };
  const at = (s: Side, rule: string, spans: Span[] = []): Cause => ({
    rule,
    spans: [s.d.declared.group.span, ...spans],
    inputs: rule === "CC-8" || !followUp ? [] : [runA],
  });
  const lower = (s: Side) => s.group?.toLowerCase();
  // shortcut: a group read from the matrix is taken to meet only its own declaration's
  // items; expand the matrix if a Workflow set needs it weighed against the others.
  const mayCollide = (x: Side, y: Side) =>
    x.readsMatrix || y.readsMatrix
      ? x.d === y.d
      : x.group === undefined || y.group === undefined || lower(x) === lower(y);
  // A callee and its caller in one group, the callee cancelling in progress (CC-7).
  const selfCancels = (x: Side, y: Side, w: World) => {
    const [callee, caller] = x.d.callee !== undefined ? [x, y] : [y, x];
    return (
      callee.d.callee !== undefined &&
      caller.d.callee === undefined &&
      callee.d.tree === caller.d.tree &&
      (caller.d.job === undefined || caller.d.job === callee.d.callee) &&
      w.cancel.get(callee) === true
    );
  };

  /** The pair's outcome for x, A and B both created in one group, under one queue mode. */
  const paired = (x: Side, a: Side, b: Side, w: World, max: boolean) => {
    const full = (followUp?.pendingRuns ?? 0) + (waiting ? 1 : 0) >= QUEUE_MAX;
    const A: Outcome = max
      ? {
          value: waiting ? "pending" : "runs",
          causes: [{ ...at(x, "CC-3"), inputs: [runA] }],
        }
      : waiting
        ? { value: "cancelled", causes: [at(x, "CC-1")] }
        : w.cancel.get(b)
          ? {
              value: "cancelled",
              causes: [
                at(
                  x,
                  "CC-2",
                  b.d.declared.cancel && [b.d.declared.cancel.span],
                ),
              ],
              ...(a.d.survivors.length > 0 && { continuing: a.d.survivors }),
            }
          : { value: "runs", causes: [at(x, "CC-1")] };
    const cc2 = !max && !waiting && w.cancel.get(b) === true;
    const B: Outcome = max
      ? full
        ? {
            value: "cancelled",
            causes: [{ ...at(x, "CC-3"), inputs: [runA, queued] }],
          }
        : {
            value: "pending",
            causes: [
              { ...at(x, "CC-3"), inputs: [runA, queued] },
              at(x, "CC-8"),
              { rule: "CC-6", spans: [], inputs: [queued] },
            ],
          }
      : cc2 && a.d.survivors.length > 0
        ? // CC-11: whether run A's survivors still hold the group is undocumented.
          {
            value: "uncertain",
            possible: ["pending", "runs"],
            causes: [
              { rule: "CC-11", spans: [], inputs: [] },
              at(x, "CC-2", b.d.declared.cancel && [b.d.declared.cancel.span]),
            ],
          }
        : w.cancel.get(b)
          ? {
              value: "runs",
              causes: [
                at(
                  x,
                  "CC-2",
                  b.d.declared.cancel && [b.d.declared.cancel.span],
                ),
              ],
            }
          : { value: "pending", causes: [at(x, "CC-1"), at(x, "CC-8")] };
    const mine = x === a ? A : B;
    const survived =
      mine.continuing && mine.value === "cancelled"
        ? [{ rule: "CC-9", spans: [], inputs: [] }]
        : [];
    return { ...mine, causes: [...mine.causes, ...survived] };
  };

  const decide = (x: Side, w: World): Outcome => {
    if (!w.created.get(x))
      return { value: "no-run", causes: x.run.verdict.causes };
    const o = met(x, w);
    // CC-5: the item's group read a property its Event leaves undefined.
    return x.empty
      ? { ...o, causes: [...o.causes, { ...at(x, "CC-5"), inputs: [] }] }
      : o;
  };

  /** A created item's outcome against the items it meets in its group. */
  const met = (x: Side, w: World): Outcome => {
    if (x.doubt) return { value: "uncertain", causes: x.doubt };
    const near = sides.filter(
      (y) => y !== x && w.created.get(y) && w.collide.get(y),
    );
    const peers = near.filter((y) => y.label === x.label);
    if (peers.length > 0)
      return peers.every((p) => selfCancels(x, p, w))
        ? {
            value: "cancelled",
            causes: [
              at(
                x,
                "CC-7",
                peers.flatMap((p) => {
                  const callee = x.d.callee !== undefined ? x : p;
                  return callee.d.declared.cancel
                    ? [callee.d.declared.cancel.span]
                    : [];
                }),
              ),
            ],
          }
        : // Two items of one Event in one group: which arrives first is undocumented (CC-6).
          { value: "uncertain", causes: [at(x, "CC-6")] };
    const others = near.filter((y) => y.label !== x.label);
    const doubtful = others.find((y) => y.doubt);
    if (doubtful) return { value: "uncertain", causes: doubtful.doubt! };
    if (others.length > 1)
      return { value: "uncertain", causes: [at(x, "CC-6")] };
    const y = others[0];
    if (!y)
      return {
        value: x.label === "A" && waiting ? "pending" : "runs",
        causes: [at(x, "CC-1")],
      };
    const [a, b] = x.label === "A" ? [x, y] : [y, x];
    const cross: Cause = {
      rule: "CC-12",
      spans: [a.d.declared.group.span, b.d.declared.group.span],
      inputs: [],
    };
    // Mixed queue modes are undocumented (CC-12): each is weighed.
    const results = (
      a.queue === b.queue ? [a.queue === "max"] : [false, true]
    ).map((max) => paired(x, a, b, w, max));
    const values = [
      ...new Set(results.flatMap((r) => r.possible ?? [r.value])),
    ];
    if (values.length > 1 && results.length > 1)
      return {
        value: "uncertain",
        causes: [cross],
        ...(values.length <= 3 && { possible: values.sort() }),
      };
    const outcome = results[0]!;
    const cased =
      a.group !== undefined && b.group !== undefined && a.group !== b.group;
    return {
      ...outcome,
      causes: [
        ...outcome.causes,
        ...(cased ? [{ ...at(x, "CC-4"), inputs: [] }] : []),
        // The arriving item's cancel-in-progress governs across files (CC-12).
        ...(a.d.file !== b.d.file ? [cross] : []),
      ],
    };
  };

  const verdict = (x: Side): Verdict => {
    // Lower-cased (CC-4), keeping the run a placeholder names: `<run_id:A>`.
    const group =
      x.group === undefined
        ? {}
        : {
            group: x.group
              .toLowerCase()
              .replace(
                /(<run_[a-z]+:)([ab])>/g,
                (_, f: string, r: string) => `${f}${r.toUpperCase()}>`,
              ),
          };
    const base = {
      key: `${x.d.prefix}concurrency.${x.label}`,
      ...group,
      groupSource: x.d.declared.group.text,
    };
    if (x.run.verdict.value === "unsupported")
      return { ...base, value: "unsupported", causes: x.run.verdict.causes };

    // One branch for each value the unknowns may take (#8 §7), x's own first.
    // shortcut: each collision is branched on its own, so an unresolved group may meet two
    // different groups in one branch; fine for the few items a Workflow set declares.
    const involved = [
      x,
      ...sides.filter(
        (y) => y !== x && y.created !== false && mayCollide(x, y),
      ),
    ];
    let worlds: World[] = [
      { created: new Map(), collide: new Map(), cancel: new Map() },
    ];
    const branch = (
      options: boolean[],
      set: (w: World, v: boolean) => void,
    ) => {
      worlds = worlds.flatMap((w) =>
        options.map((v) => {
          const next = {
            created: new Map(w.created),
            collide: new Map(w.collide),
            cancel: new Map(w.cancel),
          };
          set(next, v);
          return next;
        }),
      );
    };
    for (const s of involved) {
      branch(each(s.created), (w, v) => w.created.set(s, v));
      branch(each(s.cancel), (w, v) => w.cancel.set(s, v));
      if (s !== x)
        branch(
          x.group !== undefined && s.group !== undefined
            ? [lower(x) === lower(s)]
            : [true, false],
          (w, v) => w.collide.set(s, v),
        );
    }
    const results = worlds.map((w) => decide(x, w));
    const values = [
      ...new Set(results.flatMap((r) => r.possible ?? [r.value])),
    ];
    const gaps = results.filter((r) => r.value === "uncertain");
    if (gaps.length === 0 && values.length === 1)
      return { ...base, ...results[0]! };

    // Uncertain: rooted in what x lacks, then what the others lack, then the docs' gaps.
    const lacks = (s: Side) => [
      ...(s.created === undefined ? s.run.verdict.causes : []),
      ...s.needed.map((n): Cause => ({
        rule: "WN-4",
        spans: [n.span],
        inputs: [],
      })),
    ];
    const paths = (s: Side) =>
      [
        ...(s.created === undefined ? (s.run.verdict.settle ?? []) : []),
        ...s.needed.map((n) => n.path).filter(settleable),
      ].map((path) => ({ path, s }));
    // A path two items read is listed once, for the first; settled, the next one's shows.
    const listed = involved
      .flatMap(paths)
      .filter((p, i, all) => all.findIndex((q) => q.path === p.path) === i);
    const settle = listed.map((p) => p.path);
    // #9 §7: a value run B's Event holds goes on the Follow-up event.
    const hints = listed.map(({ path, s }): SettleHint => {
      const followUp = s.label === "B" && /^(github\.)?event\./.test(path);
      return {
        ...(s.run.verdict.hints?.find((h) => h.path === path) ?? {
          path,
          text: path.startsWith("vars.")
            ? `repository variable \`${path.slice(5)}\``
            : `\`${path}\` on the ${followUp ? "Follow-up event" : "Event"}`,
          candidates: [],
        }),
        ...(followUp && { on: "followUp" as const }),
      };
    });
    const gap = gaps.flatMap((g) => g.causes);
    return {
      ...base,
      value: "uncertain",
      causes: [
        ...involved.flatMap(lacks),
        ...gap.filter((c, i) => gap.findIndex((d) => d.rule === c.rule) === i),
      ],
      ...(values.length <= 3 &&
        gaps.every((g) => g.possible) && { possible: values.sort() }),
      settle,
      ...(settle.length > 0 && { hints }),
    };
  };

  return sides.map(verdict);
}

const each = (known: boolean | undefined) =>
  known === undefined ? [true, false] : [known];

/**
 * Run A's jobs that keep running when the run is cancelled: GitHub re-evaluates each `if:`,
 * and one still true, such as `always()`, carries on (CC-9).
 */
export function survivors(
  trees: { prefix: string; file: ParsedWorkflow }[],
  jobs: Verdict[],
  scenario: Scenario,
): string[] {
  const contexts = {
    github: githubContext(scenario),
    vars: { ...scenario.repo.vars },
    inputs: {},
    needs: {},
  };
  return trees.flatMap(({ prefix, file }) =>
    file.jobs.flatMap((job) => {
      const key = `${prefix}${job.id.value}`;
      if (jobs.find((v) => v.key === key)?.value !== "runs") return [];
      try {
        // shortcut: an `if:` reading a value the Scenario lacks is left out; list it as
        // uncertain if a Maintainer needs it.
        return evaluateCondition(job.if?.expression ?? "success()", contexts, {
          success: false,
          failure: false,
          cancelled: true,
        })
          ? [key]
          : [];
      } catch {
        return [];
      }
    }),
  );
}

/** Evaluates the group and `cancel-in-progress` against one run's Event (CC-5). */
function side(d: Declaration, run: Run, label: "A" | "B"): Side {
  const { declared, workflow } = d;
  const { scenario, verdict } = run;
  const github = {
    ...githubContext(scenario),
    workflow,
    // Each run has its own: two runs never share one (#6).
    run_id: `<run_id:${label}>`,
    run_number: `<run_number:${label}>`,
    run_attempt: `<run_attempt:${label}>`,
  };
  const needed: Side["needed"] = [];
  let empty = false;
  let readsMatrix = false;
  const vars = scenario.repo.vars ?? {};
  const resolve: Resolve = (path) => {
    const [context, ...rest] = path;
    const lower = context!.toLowerCase();
    if (lower === "vars" && rest.length > 0) {
      const found = Object.keys(vars).find(
        (k) => k.toLowerCase() === rest[0]!.toLowerCase(),
      );
      return found === undefined
        ? { needed: `vars.${rest[0]}` }
        : { value: rest.length === 1 ? vars[found] : null };
    }
    // A push or pull request run has no inputs; a callee's come from its caller's `with:`.
    if (lower === "inputs") {
      const value = rest[0] && d.inputs?.get(rest[0].toLowerCase());
      // shortcut: a `with:` expression isn't evaluated here; it reads as run-time.
      return typeof value === "string" && value.includes("${{")
        ? { needed: path.join(".") }
        : { value: value ?? null };
    }
    // A group reading the matrix differs per leg, which isn't expanded (CC-5).
    if (lower === "matrix" || lower === "strategy") readsMatrix = true;
    // needs, strategy and matrix exist only at run time.
    if (lower !== "github") return { needed: path.join(".") };
    if (rest.length === 0) return undefined;
    const field = rest[0]!.toLowerCase();
    if (
      rest.length === 1 &&
      (Object.hasOwn(github, field) || FROM_EVENT.has(field))
    ) {
      // CC-5: a property the event leaves undefined, such as head_ref on push, is empty.
      const value = (github as Record<string, unknown>)[field] ?? null;
      if (value === null) empty = true;
      return { value };
    }
    const got = readGithub(rest, scenario, github);
    if (got && "value" in got && got.value === null) empty = true;
    return got;
  };
  const contexts = {
    github,
    vars: {},
    inputs: {},
    needs: {},
    strategy: {},
    matrix: {},
  };
  const read = <T>(span: Span, f: () => T): T | undefined => {
    try {
      return f();
    } catch (e) {
      if (!(e instanceof RuntimeValueNeeded)) throw e;
      needed.push({ path: e.needed, span });
      return undefined;
    }
  };
  const group = read(declared.group.span, () =>
    evaluateTemplate(declared.group.text, contexts, resolve),
  );
  // CC-5 is the group's: cancel-in-progress reading an empty property doesn't count.
  const groupEmpty = empty;
  // The arriving run's setting decides whether it cancels (CC-2, CC-12); a callee's also
  // whether it cancels its own caller (CC-7).
  const given =
    label === "B" || d.callee !== undefined ? declared.cancel : undefined;
  const cancel =
    typeof given?.value === "string"
      ? read(
          given.span,
          () =>
            String(evaluateValue(given.value as string, contexts, resolve)) ===
            "true",
        )
      : given?.value === true;
  const possible = verdict.possible ?? [];
  // A run awaiting approval: the docs don't say whether it holds a group (#8 §2).
  const approval = verdict.causes[0]?.rule === "FK-4";
  const created = approval
    ? true
    : verdict.value !== "uncertain"
      ? CREATED.has(verdict.value)
      : possible.length > 0 && possible.every((p) => CREATED.has(p))
        ? true
        : possible.length > 0 && !possible.some((p) => CREATED.has(p))
          ? false
          : undefined;
  const doubt: Cause[] | undefined = approval
    ? verdict.causes
    : readsMatrix
      ? [
          { rule: "CC-5", spans: [declared.group.span], inputs: [] },
          { rule: "CC-6", spans: [], inputs: [] },
        ]
      : d.matrix
        ? // A constant group on a matrix job: one Event's legs share it (CC-6).
          [{ rule: "CC-6", spans: [], inputs: [] }]
        : undefined;
  return {
    d,
    run,
    label,
    created,
    group,
    readsMatrix,
    cancel,
    queue: declared.queue?.value === "max" ? "max" : "single",
    // The matrix is no value the Scenario lacks: its legs aren't expanded.
    needed: needed.filter((n) => !/^(matrix|strategy)\./i.test(n.path)),
    empty: groupEmpty,
    ...(doubt && { doubt }),
  };
}
