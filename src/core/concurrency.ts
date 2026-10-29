// The Concurrency outcome (#5 core flow 3, #76): run A of the Scenario's Event and run B of
// its Follow-up event, keyed `<file or job key> › concurrency.A` / `.B` (#6), each decided by
// CC-1, CC-2, CC-4, CC-5 and CC-8 with its resolved group.
import type { Cause, SettleHint, Verdict } from "./index";
import { githubContext, readGithub } from "./jobs";
import {
  RuntimeValueNeeded,
  evaluateTemplate,
  evaluateValue,
  type Concurrency,
  type Resolve,
  type Span,
} from "./parser";
import { FROM_EVENT, settleable, type Scenario } from "./scenario";

/** Whether a Verdict key is a run of a concurrency pair. */
export const isConcurrency = (key: string): boolean =>
  / › concurrency\.[AB]$/.test(key);

/** One run of the pair: its Scenario, with the run or job Verdict that creates its item. */
export interface Run {
  scenario: Scenario;
  verdict: Verdict;
}

/** What one run's side reads: whether it creates an item, its group and its cancel setting. */
interface Side {
  run: Run;
  label: "A" | "B";
  created: boolean | undefined;
  /** As resolved, before lower-casing; undefined while it reads a value the Scenario lacks. */
  group: string | undefined;
  cancel: boolean | undefined;
  /** The values the Scenario lacks, in the order they were read, each where it is read. */
  needed: { path: string; span: Span }[];
  /** Whether the group read a property the Event leaves undefined (CC-5). */
  empty: boolean;
}

type Outcome = Pick<Verdict, "value" | "causes">;

// GitHub creates a run that fails, so it holds its group; other values create no item.
const CREATED = new Set(["runs", "fails"]);

/**
 * The two Verdicts of one `concurrency:` declaration, `prefix` being `<file> › ` or
 * `<file> › <jobId> › `; with no Follow-up event, only run A's.
 */
export function concurrencyVerdicts(
  prefix: string,
  declared: Concurrency,
  /** What `github.workflow` reads: the workflow's `name:`, else its path. */
  workflow: string,
  a: Run,
  b?: Run,
): Verdict[] {
  const sideA = side(declared, workflow, a, "A");
  const sideB = b && side(declared, workflow, b, "B");
  const state = a.scenario.followUp?.runA ?? "in-progress";
  const runA = { path: "followUp.runA", value: state };
  const at = (rule: string, cancel = false): Cause => ({
    rule,
    spans: [
      declared.group.span,
      ...(cancel && declared.cancel ? [declared.cancel.span] : []),
    ],
    inputs: rule === "CC-8" || !sideB ? [] : [runA],
  });

  // One outcome for each value the unknowns may take (#8 §7).
  const outcomes: [Outcome, Outcome | undefined][] = [];
  for (const createdA of each(sideA.created))
    for (const createdB of sideB ? each(sideB.created) : [false])
      for (const collide of !sideB
        ? [false]
        : sideA.group !== undefined && sideB.group !== undefined
          ? [sideA.group.toLowerCase() === sideB.group.toLowerCase()]
          : [true, false])
        for (const cancel of sideB ? each(sideB.cancel) : [false]) {
          const noRun = (s: Side): Outcome => ({
            value: "no-run",
            causes: s.run.verdict.causes,
          });
          const mine = (s: Side, o: Outcome): Outcome => ({
            ...o,
            causes: [
              ...o.causes,
              ...(collide &&
              createdA &&
              createdB &&
              sideA.group !== sideB?.group
                ? [{ ...at("CC-4"), inputs: [] }]
                : []),
              ...(s.empty ? [{ ...at("CC-5"), inputs: [] }] : []),
            ],
          });
          const waiting = state === "pending";
          const kept: Outcome = {
            value: waiting ? "pending" : "runs",
            causes: [at("CC-1")],
          };
          let A: Outcome = createdA ? kept : noRun(sideA);
          let B: Outcome | undefined =
            sideB &&
            (createdB ? { value: "runs", causes: [at("CC-1")] } : noRun(sideB));
          if (sideB && createdA && createdB && collide) {
            // A pending item is replaced either way (CC-1); cancel-in-progress also cancels
            // the running one (CC-2), and run B's own setting governs.
            A = waiting
              ? { value: "cancelled", causes: [at("CC-1")] }
              : cancel
                ? { value: "cancelled", causes: [at("CC-2", true)] }
                : kept;
            B = cancel
              ? { value: "runs", causes: [at("CC-2", true)] }
              : { value: "pending", causes: [at("CC-1"), at("CC-8")] };
          }
          outcomes.push([
            createdA ? mine(sideA, A) : A,
            sideB && B && (createdB ? mine(sideB, B) : B),
          ]);
        }

  const verdict = (s: Side, other: Side | undefined, i: 0 | 1): Verdict => {
    const results = outcomes.map((o) => o[i]!);
    const values = [...new Set(results.map((r) => r.value))];
    // Lower-cased (CC-4), keeping the run a placeholder names: `<run_id:A>`.
    const group =
      s.group === undefined
        ? {}
        : {
            group: s.group
              .toLowerCase()
              .replace(
                /(<run_[a-z]+:)([ab])>/g,
                (_, f: string, r: string) => `${f}${r.toUpperCase()}>`,
              ),
          };
    const base = {
      key: `${prefix}concurrency.${s.label}`,
      ...group,
      groupSource: declared.group.text,
    };
    if (s.run.verdict.value === "unsupported")
      return { ...base, value: "unsupported", causes: s.run.verdict.causes };
    if (values.length === 1) return { ...base, ...results[0]! };
    // Uncertain: rooted in what its own run lacks, then what the other run lacks.
    const lacks = (x: Side) => [
      ...(x.created === undefined ? x.run.verdict.causes : []),
      ...x.needed.map((n): Cause => ({
        rule: "WN-4",
        spans: [n.span],
        inputs: [],
      })),
    ];
    const paths = (x: Side) =>
      [
        ...(x.created === undefined ? (x.run.verdict.settle ?? []) : []),
        ...x.needed.map((n) => n.path).filter(settleable),
      ].map((path) => ({ path, x }));
    // A path both runs read is listed once, for this run's Event; settled, the other's shows.
    const listed = [...paths(s), ...(other ? paths(other) : [])].filter(
      (p, i, all) => all.findIndex((q) => q.path === p.path) === i,
    );
    const settle = listed.map((p) => p.path);
    // #9 §7: a value run B's Event holds goes on the Follow-up event.
    const hints = listed.map(({ path, x }): SettleHint => {
      const followUp = x.label === "B" && /^(github\.)?event\./.test(path);
      return {
        ...(x.run.verdict.hints?.find((h) => h.path === path) ?? {
          path,
          text: path.startsWith("vars.")
            ? `repository variable \`${path.slice(5)}\``
            : `\`${path}\` on the ${followUp ? "Follow-up event" : "Event"}`,
          candidates: [],
        }),
        ...(followUp && { on: "followUp" as const }),
      };
    });
    return {
      ...base,
      value: "uncertain",
      causes: [...lacks(s), ...(other ? lacks(other) : [])],
      ...(values.length <= 3 && { possible: values.sort() }),
      settle,
      ...(settle.length > 0 && { hints }),
    };
  };

  return [
    verdict(sideA, sideB, 0),
    ...(sideB ? [verdict(sideB, sideA, 1)] : []),
  ];
}

const each = (known: boolean | undefined) =>
  known === undefined ? [true, false] : [known];

/** Evaluates the group and `cancel-in-progress` against one run's Event (CC-5). */
function side(
  declared: Concurrency,
  workflow: string,
  run: Run,
  label: "A" | "B",
): Side {
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
    // A push or pull request run has no inputs.
    if (lower === "inputs") return { value: null };
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
  // Only the arriving run's setting decides whether it cancels (CC-2).
  const given = label === "B" ? declared.cancel : undefined;
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
  const created =
    verdict.value !== "uncertain"
      ? CREATED.has(verdict.value)
      : possible.length > 0 && possible.every((p) => CREATED.has(p))
        ? true
        : possible.length > 0 && !possible.some((p) => CREATED.has(p))
          ? false
          : undefined;
  return { run, label, created, group, cancel, needed, empty };
}
