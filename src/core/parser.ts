// The one adapter over @actions/workflow-parser and @actions/expressions (pinned to 0.3.61).
// Diff their .d.ts files on every upgrade: the API shifts between minor releases.
import {
  Evaluator,
  Lexer,
  Parser,
  data,
  type Expr,
} from "@actions/expressions";
import {
  Binary,
  ContextAccess,
  FunctionCall,
  Grouping,
  IndexAccess,
  Literal,
  Logical,
  Star,
  Unary,
} from "@actions/expressions/ast";
import type { FunctionDefinition } from "@actions/expressions/funcs/info";
import { truthy } from "@actions/expressions/result";
import {
  NoOperationTraceWriter,
  isString,
  parseWorkflow,
} from "@actions/workflow-parser";
import { convertConcurrency } from "@actions/workflow-parser/model/converter/concurrency";
import { convertOn } from "@actions/workflow-parser/model/converter/events";
import { handleTemplateTokenErrors } from "@actions/workflow-parser/model/converter/handle-errors";
import { convertJobs } from "@actions/workflow-parser/model/converter/jobs";
import type {
  EventsConfig,
  WorkflowJob,
} from "@actions/workflow-parser/model/workflow-template";
import type { TemplateToken } from "@actions/workflow-parser/templates/tokens/template-token";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Document,
  type Node,
  type Pair,
} from "yaml";

/** A 1-based position range in one file. */
export interface Span {
  path: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

/** A problem that makes GitHub reject a file, at its position; the file gets no Verdicts. */
export interface Diagnostic extends Span {
  /** The rule ID, when a rule in the catalogue says GitHub rejects it. */
  rule?: string;
  message: string;
}

export interface ParsedWorkflow {
  /** Why GitHub would reject the file (malformed YAML, schema or converter errors), if it would. */
  diagnostics: Diagnostic[];
  /** The events `on:` lists, as the parser converted them. */
  events: EventsConfig;
  /** The `on` key itself. */
  onSpan: Span | undefined;
  /**
   * Each `on:` entry by event name, at its own position (an alias reports its own line),
   * plus each event's settings as `event.key` and their list items as `event.key.i`.
   */
  onEntries: Map<string, Span>;
  /** The jobs as the parser converted them; `if` already carries the implicit `success() &&`. */
  jobs: WorkflowJob[];
  /** Each job's positions by job id. */
  jobSpans: Map<string, JobSpans>;
  /** The workflow-level `permissions:` block. */
  permissions?: Permissions;
  /**
   * `on.workflow_call.inputs` as written, by declared name: the converter drops number and
   * expression defaults.
   */
  callInputs: Map<string, { type?: unknown; default?: unknown }>;
  /** The workflow-level `name:`, which `github.workflow` reads. */
  name?: string;
  /** The workflow-level `concurrency:`: the converter checks it and drops it. */
  concurrency?: Concurrency;
}

/** A `concurrency:` setting as written, a scalar being its group (CC-1, CC-2). */
export interface Concurrency {
  /** The group as written, at its value. */
  group: { text: string; span: Span };
  /** `cancel-in-progress` as written: a boolean, or a `${{ }}` string. */
  cancel?: { value: unknown; span: Span };
  /** `queue` as written: `single` (the default) or `max` (CC-3). */
  queue?: { value: unknown; span: Span };
}

/** A `permissions:` block as written: the parser drops it, so it's read from the YAML (PERM-11). */
export interface Permissions {
  /** The `permissions` key. */
  span: Span;
  /** `read-all` or `write-all`; a mapping lists `scopes` instead. */
  all?: string;
  /** Each listed scope's level, at its `scope: level` pair. */
  scopes: Map<string, { level: string; span: Span }>;
}

/** A job's positions; a job reached through an alias points every field at the alias. */
export interface JobSpans {
  id: Span;
  /** The `name:` value. */
  name?: Span;
  if?: Span;
  needs?: Span;
  /** Only when job-level `continue-on-error` is literally `true`. */
  continueOnError?: Span;
  permissions?: Permissions;
  /** The `environment` key. */
  environment?: Span;
  /** The job's `actions/checkout` steps, in order (CO-1). */
  checkouts: Checkout[];
  /** A caller's `uses:` value. */
  uses?: Span;
  /** A caller's `secrets:` value. */
  secrets?: Span;
  /** The job-level `concurrency:`. */
  concurrency?: Concurrency;
}

/** An `actions/checkout` step as written: the parser drops `with:`. */
export interface Checkout {
  /** The `uses:` pair. */
  uses: Span;
  /** What follows `@`. */
  version: string;
  /** `with: ref` and `with: repository`, as written. */
  ref?: { text: string; span: Span };
  repository?: { text: string; span: Span };
  /** `with: allow-unsafe-pr-checkout` is literally `true`. */
  optOut: boolean;
  /** Only when step-level `continue-on-error` is literally `true`. */
  continueOnError?: Span;
}

/**
 * A job's required-check name (RQ-0): its `name:` if set and non-empty, else its id, as the
 * parser's `jobName()` gives it. Undefined when `name:` is an expression.
 */
export const checkName = (job: WorkflowJob): string | undefined =>
  job.name && isString(job.name) ? job.name.value : undefined;

const ALIAS_BOMB = "Too many YAML aliases: WhyNoRun stopped reading this file";

// Keys GitHub documents that the bundled schema rejects (#2 risks), by the mapping they sit in.
const SCHEMA_LAG = { root: ["cache-mode"], step: ["background"] };

export function parseWorkflowFile(path: string, text: string): ParsedWorkflow {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter });
  const span = (node: Node): Span => {
    const [start, end] = node.range ?? [0, 0];
    const a = lineCounter.linePos(start);
    const b = lineCounter.linePos(end);
    return { path, line: a.line, col: a.col, endLine: b.line, endCol: b.col };
  };
  const at = (line: number, col: number, endLine = line, endCol = col) => ({
    path,
    line,
    col,
    endLine,
    endCol,
  });
  const none = {
    events: {},
    jobs: [],
    onSpan: undefined,
    onEntries: new Map(),
    jobSpans: new Map(),
    callInputs: new Map(),
  };

  // The workflow parser expands every alias with no limit (#2 risks), so stop a bomb first.
  try {
    doc.toJS({ maxAliasCount: 1000 });
  } catch (err) {
    // Other throws (an alias with no anchor) are malformed YAML the parser reports itself.
    if (err instanceof ReferenceError && /alias count/.test(err.message))
      return { ...none, diagnostics: [{ ...at(1, 1), message: ALIAS_BOMB }] };
  }

  const { context, value } = parseWorkflow(
    { name: path, content: text },
    new NoOperationTraceWriter(),
  );
  // Malformed YAML leaves no token tree; converting it would only add a junk error.
  const { events, jobs } =
    value === undefined ? { events: {}, jobs: [] } : convert(context, value);
  const lagging = schemaLag(doc, span);
  const diagnostics: Diagnostic[] = [];
  for (const e of context.errors.getErrors()) {
    const where = e.range
      ? at(
          e.range.start.line,
          e.range.start.column,
          e.range.end.line,
          e.range.end.column,
        )
      : at(1, 1);
    if (lagging.has(`${where.line}:${where.col}`)) continue;
    // A YAML error repeats its position and the source line after the first line.
    const message = e.rawMessage
      .split("\n")[0]!
      .replace(/ at line \d+, column \d+:$/, "");
    diagnostics.push({ ...where, message });
  }
  return {
    ...indexOn(doc, span),
    callInputs: callInputs(doc),
    diagnostics,
    events,
    jobs,
  };
}

function callInputs(doc: Document): ParsedWorkflow["callInputs"] {
  const node = doc.getIn(["on", "workflow_call", "inputs"], true);
  const inputs: unknown = isMap(node) ? node.toJS(doc) : {};
  return new Map(
    Object.entries(inputs as object).map(([k, v]) => [
      k,
      typeof v === "object" && v !== null ? v : {},
    ]),
  );
}

/** The positions of the keys in SCHEMA_LAG, as `line:col`. */
function schemaLag(doc: Document, span: (node: Node) => Span): Set<string> {
  const found = new Set<string>();
  const keys = (map: unknown, names: string[]) => {
    if (!isMap(map)) return;
    for (const pair of map.items)
      if (isScalar(pair.key) && names.includes(String(pair.key.value))) {
        const { line, col } = span(pair.key);
        found.add(`${line}:${col}`);
      }
  };
  keys(doc.contents, SCHEMA_LAG.root);
  const jobs = isMap(doc.contents) ? doc.contents.get("jobs") : undefined;
  if (isMap(jobs))
    for (const job of jobs.items) {
      const steps = isMap(job.value) ? job.value.get("steps") : undefined;
      if (isSeq(steps))
        for (const step of steps.items) keys(step, SCHEMA_LAG.step);
    }
  return found;
}

// convertWorkflowTemplate() under ErrorPolicy.TryConversion (convert even when the schema
// reported errors), minus the reusable-workflow fetch: upstream is async only for that
// fetch, and simulate() must stay synchronous.
function convert(
  context: Parameters<typeof convertOn>[0],
  root: TemplateToken,
): Pick<ParsedWorkflow, "events" | "jobs"> {
  let events: EventsConfig = {};
  let jobs: WorkflowJob[] = [];
  handleTemplateTokenErrors(root, context, undefined, () => {
    for (const item of root.assertMapping("root")) {
      const key = item.key.assertString("root key").value;
      const run = <T>(fallback: T, f: () => T) =>
        handleTemplateTokenErrors(root, context, fallback, f);
      if (key === "on") events = run({}, () => convertOn(context, item.value));
      if (key === "jobs")
        jobs = run([], () => convertJobs(context, item.value));
      if (key === "concurrency")
        run({}, () => convertConcurrency(context, item.value));
    }
  });
  return { events, jobs };
}

// Positions come from the yaml library's own nodes: the workflow parser gives a node reached
// through an alias its anchor's line, and Verdicts must point at the line that uses it.
function indexOn(
  doc: Document,
  span: (node: Node) => Span,
): Pick<
  ParsedWorkflow,
  "onSpan" | "onEntries" | "jobSpans" | "permissions" | "name" | "concurrency"
> {
  const onEntries = new Map<string, Span>();
  const jobSpans = new Map<string, JobSpans>();
  if (!isMap(doc.contents)) return { onSpan: undefined, onEntries, jobSpans };

  // A block reached through an alias points every span at the alias, as `on:` does below.
  const permissions = (
    pair: Pair | undefined,
    own: Span | undefined,
  ): Permissions | undefined => {
    if (!pair) return undefined;
    const via = own ?? (isAlias(pair.value) ? span(pair.value) : undefined);
    const value = resolve(doc, pair.value);
    const scopes = new Map<string, { level: string; span: Span }>();
    for (const p of isMap(value) ? value.items : []) {
      const scope = name(doc, p.key);
      const level = name(doc, p.value);
      if (scope === undefined || level === undefined) continue;
      const end = span((p.value ?? p.key) as Node);
      scopes.set(scope, {
        level,
        span: via ?? {
          ...span(p.key as Node),
          endLine: end.endLine,
          endCol: end.endCol,
        },
      });
    }
    return {
      span: own ?? span(pair.key as Node),
      all: isMap(value) ? undefined : name(doc, value),
      scopes,
    };
  };
  const root = doc.contents.items.find(
    (p) => name(doc, p.key) === "permissions",
  );
  const concurrency = (
    pair: Pair | undefined,
    own: Span | undefined,
  ): Concurrency | undefined => {
    if (!pair) return undefined;
    const via = own ?? (isAlias(pair.value) ? span(pair.value) : undefined);
    const value = resolve(doc, pair.value);
    const at = (key: string) => {
      const v = isMap(value)
        ? resolve(doc, value.items.find((p) => name(doc, p.key) === key)?.value)
        : undefined;
      return isScalar(v) ? { value: v.value, span: via ?? span(v) } : undefined;
    };
    const group = isScalar(value)
      ? { value: value.value, span: via ?? span(value) }
      : at("group");
    const cancel = at("cancel-in-progress");
    const queue = at("queue");
    return {
      group: {
        text: String(group?.value ?? ""),
        span: group?.span ?? via ?? span(pair.key as Node),
      },
      ...(cancel && { cancel }),
      ...(queue && { queue }),
    };
  };

  const jobsPair = doc.contents.items.find((p) => name(doc, p.key) === "jobs");
  const jobs = resolve(doc, jobsPair?.value);
  for (const item of isMap(jobs) ? jobs.items : []) {
    const id = name(doc, item.key);
    const body = resolve(doc, item.value);
    if (id === undefined || !isMap(body)) continue;
    const own = isAlias(item.value) ? span(item.value) : undefined;
    const field = (key: string) => {
      const p = body.items.find((f) => name(doc, f.key) === key);
      return p && { pair: p, span: own ?? span((p.value ?? p.key) as Node) };
    };
    const coe = field("continue-on-error");
    const coeValue = resolve(doc, coe?.pair.value);
    const env = field("environment");
    const steps = resolve(doc, field("steps")?.pair.value);
    jobSpans.set(id, {
      id: span(item.key as Node),
      name: field("name")?.span,
      if: field("if")?.span,
      needs: field("needs")?.span,
      continueOnError:
        isScalar(coeValue) && coeValue.value === true ? coe!.span : undefined,
      permissions: permissions(field("permissions")?.pair, own),
      environment: env && (own ?? span(env.pair.key as Node)),
      checkouts: isSeq(steps) ? checkouts(doc, steps.items, own, span) : [],
      uses: field("uses")?.span,
      secrets: field("secrets")?.span,
      concurrency: concurrency(field("concurrency")?.pair, own),
    });
  }

  const workflow = {
    jobSpans,
    permissions: permissions(root, undefined),
    name: name(doc, doc.contents.get("name", true)),
    concurrency: concurrency(
      doc.contents.items.find((p) => name(doc, p.key) === "concurrency"),
      undefined,
    ),
  };
  const pair = doc.contents.items.find((p) => name(doc, p.key) === "on");
  if (!pair || !isScalar(pair.key))
    return { ...workflow, onSpan: undefined, onEntries };

  // `on: *events` points every entry at the alias, on the on: line.
  const own = isAlias(pair.value) ? span(pair.value) : undefined;
  const value = resolve(doc, pair.value);
  const entries = isSeq(value)
    ? value.items
    : isMap(value)
      ? value.items.map((p) => p.key)
      : [value];
  for (const entry of entries) {
    const event = name(doc, entry);
    if (event !== undefined && !onEntries.has(event))
      onEntries.set(event, own ?? span(entry as Node));
  }
  // Settings reached through an alias point at the alias, as the entries above do.
  for (const pair of isMap(value) ? value.items : []) {
    const event = name(doc, pair.key);
    if (event === undefined) continue;
    const viaEvent =
      own ?? (isAlias(pair.value) ? span(pair.value) : undefined);
    const settings = resolve(doc, pair.value);
    for (const setting of isMap(settings) ? settings.items : []) {
      const key = name(doc, setting.key);
      if (key === undefined || !isScalar(setting.key)) continue;
      const at = `${event}.${key}`;
      if (!onEntries.has(at)) onEntries.set(at, viaEvent ?? span(setting.key));
      const via =
        viaEvent ?? (isAlias(setting.value) ? span(setting.value) : undefined);
      const list = resolve(doc, setting.value);
      const items = isSeq(list) ? list.items : [list];
      items.forEach((item, i) => {
        if (isAlias(item) || isScalar(item))
          onEntries.set(`${at}.${i}`, via ?? span(item));
      });
    }
  }
  return { ...workflow, onSpan: span(pair.key), onEntries };
}

const CHECKOUT = /^actions\/checkout@(.+)$/i;

/** The `actions/checkout` steps among `items`, each span at the alias when `own` is one. */
function checkouts(
  doc: Document,
  items: unknown[],
  own: Span | undefined,
  span: (node: Node) => Span,
): Checkout[] {
  return items.flatMap((item) => {
    const step = resolve(doc, item);
    if (!isMap(step)) return [];
    const pair = (map: unknown, key: string) =>
      isMap(map) ? map.items.find((p) => name(doc, p.key) === key) : undefined;
    const at = (p: Pair) =>
      own ?? {
        ...span(p.key as Node),
        endLine: span((p.value ?? p.key) as Node).endLine,
        endCol: span((p.value ?? p.key) as Node).endCol,
      };
    const uses = pair(step, "uses");
    const version = CHECKOUT.exec(name(doc, uses?.value) ?? "")?.[1];
    if (!uses || version === undefined) return [];
    const scalar = (p: Pair | undefined) => {
      const v = resolve(doc, p?.value);
      return isScalar(v) ? v.value : undefined;
    };
    const input = (key: string) => {
      const p = pair(resolve(doc, pair(step, "with")?.value), key);
      const v = scalar(p);
      return v === undefined || v === null || v === ""
        ? undefined
        : { text: String(v), span: at(p!) };
    };
    const optOut = input("allow-unsafe-pr-checkout")?.text === "true";
    const coe = pair(step, "continue-on-error");
    return [
      {
        uses: at(uses),
        version,
        ref: input("ref"),
        repository: input("repository"),
        optOut,
        continueOnError: scalar(coe) === true ? at(coe!) : undefined,
      },
    ];
  });
}

function resolve(doc: Document, node: unknown): unknown {
  return isAlias(node) ? node.resolve(doc) : node;
}

function name(doc: Document, node: unknown): string | undefined {
  const target = resolve(doc, node);
  return isScalar(target) && typeof target.value === "string"
    ? target.value
    : undefined;
}

/** Thrown when an expression reads a value the resolver says the Scenario lacks. */
export class RuntimeValueNeeded extends Error {
  constructor(
    /** What the resolver named the missing value. */
    readonly needed: string,
    /** The literals the expression compares the read path with, in order. */
    readonly compared: unknown[] = [],
  ) {
    super(needed);
  }
}

/**
 * Answers a read of a context path (one segment per key, `*` for a star): its value, that
 * the Scenario lacks it, or undefined to read the contexts as given. `compared` gives the
 * literals the expression compares the path with.
 */
export type Resolve = (
  path: string[],
  compared: () => unknown[],
) => { value: unknown } | { needed: string } | undefined;

/** The context path an expression reads, when it is one: `a.b`, `a['b']` and `a.*.b`. */
function pathOf(e: Expr): string[] | undefined {
  if (e instanceof ContextAccess) return [e.name.lexeme];
  if (!(e instanceof IndexAccess)) return undefined;
  const base = pathOf(e.expr);
  if (!base) return undefined;
  if (e.index instanceof Star) return [...base, "*"];
  if (e.index instanceof Literal && e.index.literal instanceof data.StringData)
    return [...base, e.index.literal.value];
  return undefined;
}

const samePath = (a: string[] | undefined, b: string[]) =>
  a !== undefined &&
  a.length === b.length &&
  a.every((s, i) => s.toLowerCase() === b[i]!.toLowerCase());

const COMPARISONS = new Set(["==", "!=", "<", "<=", ">", ">="]);

const plain = (d: data.ExpressionData): unknown =>
  d instanceof data.Null
    ? null
    : "value" in d
      ? (d as { value: unknown }).value
      : undefined;

/** The literals `root` compares `path` with, through an operator or a function's arguments. */
function comparedWith(root: Expr, path: string[]): unknown[] {
  const found: unknown[] = [];
  const visit = (e: Expr) => {
    let pair: Expr[] = [];
    if (e instanceof Binary) {
      if (COMPARISONS.has(e.operator.lexeme)) pair = [e.left, e.right];
      visit(e.left);
      visit(e.right);
    } else if (e instanceof FunctionCall) {
      pair = e.args;
      e.args.forEach(visit);
    } else if (e instanceof Logical) e.args.forEach(visit);
    else if (e instanceof Unary) visit(e.expr);
    else if (e instanceof Grouping) visit(e.group);
    if (pair.some((p) => samePath(pathOf(p), path)))
      for (const p of pair)
        if (p instanceof Literal) found.push(plain(p.literal));
  };
  visit(root);
  return [...new Set(found)];
}

const toData = (value: unknown): data.ExpressionData =>
  JSON.parse(
    JSON.stringify(value ?? null),
    data.reviver,
  ) as data.ExpressionData;

// Reads context paths through the resolver first: it knows which values the Scenario lacks,
// and reads user-keyed maps with Object.hasOwn, which the library's Dictionary doesn't.
class Reader extends Evaluator {
  constructor(
    private readonly root: Expr,
    context: data.Dictionary,
    functions: Map<string, FunctionDefinition>,
    private readonly resolve: Resolve,
  ) {
    super(root, context, functions);
  }
  private read(e: Expr): data.ExpressionData | undefined {
    const path = pathOf(e);
    if (!path) return undefined;
    const compared = () => comparedWith(this.root, path);
    const got = this.resolve(path, compared);
    if (!got) return undefined;
    if ("needed" in got) throw new RuntimeValueNeeded(got.needed, compared());
    return toData(got.value);
  }
  override visitContextAccess(e: ContextAccess): data.ExpressionData {
    return this.read(e) ?? super.visitContextAccess(e);
  }
  override visitIndexAccess(e: IndexAccess): data.ExpressionData {
    return this.read(e) ?? super.visitIndexAccess(e);
  }
}

/** What a job's status functions return, worked out from its `needs`. */
export interface Status {
  success: boolean;
  failure: boolean;
}

// GitHub's status functions are missing from @actions/expressions, and a stub must be
// registered in both the Parser (to validate) and the Evaluator (to run).
// shortcut: success(id) and failure(id) ignore their arguments and read every need; upgrade
// when a Verdict needs the per-job form.
const stubs = (status: Status): FunctionDefinition[] => [
  stub("success", 0, () => new data.BooleanData(status.success)),
  stub("always", 0, () => new data.BooleanData(true)),
  stub("failure", 0, () => new data.BooleanData(status.failure)),
  stub("cancelled", 0, () => new data.BooleanData(false)),
  // The files exist only in the run's workspace, so its result is a run-time value.
  stub("hashFiles", 1, () => {
    throw new RuntimeValueNeeded("hashFiles()");
  }),
];

function stub(
  name: string,
  minArgs: number,
  call: () => data.ExpressionData,
): FunctionDefinition {
  return { name, minArgs, maxArgs: Number.MAX_SAFE_INTEGER, call };
}

/** Evaluates one condition (without `${{ }}`) against contexts given as plain JSON. */
export function evaluateCondition(
  source: string,
  contexts: Record<string, unknown>,
  status: Status,
  resolve: Resolve = () => undefined,
): boolean {
  return truthy(evaluate(source, contexts, status, resolve));
}

/** The string a value with `${{ }}` expressions in it becomes, such as a step's `with:` input. */
export function evaluateTemplate(
  text: string,
  contexts: Record<string, unknown>,
  resolve: Resolve,
): string {
  const status = { success: true, failure: false };
  // shortcut: a `}}` inside a string literal ends the expression early; parse the template
  // with the workflow parser if an input ever needs one.
  return text.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, source: string) =>
    evaluate(source, contexts, status, resolve).coerceString(),
  );
}

/** A value written with `${{ }}`: one expression alone keeps its type, as GitHub's inputs do. */
export function evaluateValue(
  text: string,
  contexts: Record<string, unknown>,
  resolve: Resolve,
): unknown {
  const alone = /^\$\{\{([\s\S]*?)\}\}$/.exec(text.trim());
  return alone && !alone[1]!.includes("}}")
    ? plain(
        evaluate(
          alone[1]!,
          contexts,
          { success: true, failure: false },
          resolve,
        ),
      )
    : evaluateTemplate(text, contexts, resolve);
}

function evaluate(
  source: string,
  contexts: Record<string, unknown>,
  status: Status,
  resolve: Resolve,
): data.ExpressionData {
  const funcs = stubs(status);
  const { tokens } = new Lexer(source).lex();
  const expr = new Parser(tokens, Object.keys(contexts), funcs).parse();
  const dict = JSON.parse(
    JSON.stringify(contexts),
    data.reviver,
  ) as data.Dictionary;
  return new Reader(
    expr,
    dict,
    // The Evaluator looks functions up by lower-cased name.
    new Map(funcs.map((f) => [f.name.toLowerCase(), f])),
    resolve,
  ).evaluate();
}
