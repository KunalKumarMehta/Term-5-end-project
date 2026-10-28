// The one adapter over @actions/workflow-parser and @actions/expressions (pinned to 0.3.61).
// Diff their .d.ts files on every upgrade: the API shifts between minor releases.
import { Evaluator, Lexer, Parser, data } from "@actions/expressions";
import type { FunctionDefinition } from "@actions/expressions/funcs/info";
import { truthy } from "@actions/expressions/result";
import {
  NoOperationTraceWriter,
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
} from "yaml";

/** A 1-based position range in one file. */
export interface Span {
  path: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

export interface ParsedWorkflow {
  /** False when GitHub would reject the file (malformed YAML, schema or converter errors). */
  ok: boolean;
  /** The events `on:` lists, as the parser converted them. */
  events: EventsConfig;
  /** The `on` key itself. */
  onSpan: Span | undefined;
  /** Each `on:` entry by event name, at its own position (an alias reports its own line). */
  onEntries: Map<string, Span>;
  /** The jobs as the parser converted them; `if` already carries the implicit `success() &&`. */
  jobs: WorkflowJob[];
  /** Each job's positions by job id. */
  jobSpans: Map<string, JobSpans>;
}

/** A job's positions; a job reached through an alias points every field at the alias. */
export interface JobSpans {
  id: Span;
  if?: Span;
  needs?: Span;
  /** Only when job-level `continue-on-error` is literally `true`. */
  continueOnError?: Span;
}

export function parseWorkflowFile(path: string, text: string): ParsedWorkflow {
  const index = indexOn(path, text);
  const { context, value } = parseWorkflow(
    { name: path, content: text },
    new NoOperationTraceWriter(),
  );
  // Malformed YAML leaves no token tree; converting it would only add a junk error.
  if (value === undefined) return { ...index, ok: false, events: {}, jobs: [] };
  return {
    ...index,
    ...convert(context, value),
    ok: context.errors.getErrors().length === 0,
  };
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
  path: string,
  text: string,
): Pick<ParsedWorkflow, "onSpan" | "onEntries" | "jobSpans"> {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter });
  const span = (node: Node): Span => {
    const [start, end] = node.range ?? [0, 0];
    const a = lineCounter.linePos(start);
    const b = lineCounter.linePos(end);
    return { path, line: a.line, col: a.col, endLine: b.line, endCol: b.col };
  };
  const onEntries = new Map<string, Span>();
  const jobSpans = new Map<string, JobSpans>();
  if (!isMap(doc.contents)) return { onSpan: undefined, onEntries, jobSpans };

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
    jobSpans.set(id, {
      id: span(item.key as Node),
      if: field("if")?.span,
      needs: field("needs")?.span,
      continueOnError:
        isScalar(coeValue) && coeValue.value === true ? coe!.span : undefined,
    });
  }

  const pair = doc.contents.items.find((p) => name(doc, p.key) === "on");
  if (!pair || !isScalar(pair.key))
    return { onSpan: undefined, onEntries, jobSpans };

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
  return { onSpan: span(pair.key), onEntries, jobSpans };
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

/** Thrown by stubs for values that exist only at run time, such as hashFiles(). */
export class RuntimeValueNeeded extends Error {}

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
): boolean {
  const funcs = stubs(status);
  const { tokens } = new Lexer(source).lex();
  const expr = new Parser(tokens, Object.keys(contexts), funcs).parse();
  const dict = JSON.parse(
    JSON.stringify(contexts),
    data.reviver,
  ) as data.Dictionary;
  return truthy(
    new Evaluator(
      expr,
      dict,
      // The Evaluator looks functions up by lower-cased name.
      new Map(funcs.map((f) => [f.name.toLowerCase(), f])),
    ).evaluate(),
  );
}
