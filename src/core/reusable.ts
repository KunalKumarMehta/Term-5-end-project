// Reusable workflows (#66): local callees one level deep through `./` and `$/` (the
// FileProvider the parser would use), remote callers never fetched (#8 §10, WN-6).
import type { Diagnostic, ParsedWorkflow, Span } from "./parser";
import type { ReusableWorkflowJob } from "@actions/workflow-parser/model/workflow-template";

const DIR = ".github/workflows/";

/** `./` and `$/` name a file in this repository at the caller's commit. */
export const isLocal = (ref: string): boolean =>
  ref.startsWith("./") || ref.startsWith("$/");

/** A caller job, with where its `uses:` points. */
export interface Call {
  job: ReusableWorkflowJob;
  /** The `uses:` value. */
  span: Span;
  /** A local callee's path from the repo root; undefined for a remote one. */
  path?: string;
}

export function calls(parsed: ParsedWorkflow): Call[] {
  return parsed.jobs.flatMap((job) => {
    if (job.type !== "reusableWorkflowJob") return [];
    const ref = job.ref.value;
    const local = isLocal(ref);
    const span = parsed.jobSpans.get(job.id.value)?.uses;
    if (!span) return [];
    return [{ job, span, ...(local && { path: ref.slice(2) }) }];
  });
}

/** The file name under `.github/workflows/` a local callee path names, if GitHub reads it there. */
export const calleeKey = (path: string): string | undefined =>
  path.startsWith(DIR) && !path.slice(DIR.length).includes("/")
    ? path.slice(DIR.length)
    : undefined;

/**
 * A caller file's own call Diagnostics: a local `uses:` outside `.github/workflows/` (PL-0)
 * or to a file not in the set (RU-4).
 */
export function callDiagnostics(
  parsed: ParsedWorkflow,
  present: Set<string>,
): Diagnostic[] {
  return calls(parsed).flatMap(({ span, path }) => {
    if (path === undefined) return [];
    const key = calleeKey(path);
    if (key === undefined)
      return [
        {
          ...span,
          rule: "PL-0",
          message: `\`${path}\` isn't directly in \`.github/workflows/\`, the only place GitHub reads a called workflow from.`,
        },
      ];
    if (present.has(key)) return [];
    return [
      {
        ...span,
        rule: "RU-4",
        message: `\`${path}\` isn't in the Workflow set. Paste or upload it.`,
      },
    ];
  });
}

/** RU-4 for each direct local call into a file with Diagnostics; it never cascades further. */
export function brokenCalleeDiagnostics(
  parsed: ParsedWorkflow,
  broken: Set<string>,
): Diagnostic[] {
  return calls(parsed).flatMap(({ span, path }) => {
    const key = path === undefined ? undefined : calleeKey(path);
    return key !== undefined && broken.has(key)
      ? [
          {
            ...span,
            rule: "RU-4",
            message: `Called workflow \`${path}\` has Diagnostics; fix them to simulate this file.`,
          },
        ]
      : [];
  });
}

/** Whether the file is only a callee: its `on:` lists nothing but `workflow_call` (#6). */
export const calleeOnly = (parsed: ParsedWorkflow): boolean =>
  Object.keys(parsed.events).join() === "workflow_call";

/**
 * RU-2: the first local call that passes a secret its callee doesn't declare, or leaves out
 * one declared `required: true`. `inherit` is never checked (#11).
 */
export function contractError(
  parsed: ParsedWorkflow,
  files: Map<string, ParsedWorkflow>,
): Span | undefined {
  for (const { job, span, path } of calls(parsed)) {
    const callee = path === undefined ? undefined : files.get(calleeKey(path)!);
    if (!callee || job["inherit-secrets"]) continue;
    // GitHub matches secret names ignoring case.
    const declared = new Map(
      Object.entries(callee.events.workflow_call?.secrets ?? {}).map(
        ([name, config]) => [name.toLowerCase(), config],
      ),
    );
    const values = job["secret-values"];
    const passed = Array.from({ length: values?.count ?? 0 }, (_, i) =>
      values!.get(i).key.toString().toLowerCase(),
    );
    if (
      passed.some((name) => !declared.has(name)) ||
      [...declared].some(([name, c]) => c.required && !passed.includes(name))
    )
      return span;
  }
  return undefined;
}

// What GitHub gives a declared input with no value and no default.
const UNSET: Record<string, unknown> = { boolean: false, number: 0 };

/**
 * The callee's `inputs` context for one call, keyed by lower-cased name as GitHub matches
 * them: the caller job's `with:` value, else the declared default, else the type's empty
 * value. An expression stays `${{ }}` text for the job resolver to evaluate.
 */
export function inputsOf(
  job: ReusableWorkflowJob,
  callee: ParsedWorkflow,
): Map<string, unknown> {
  const given = new Map<string, unknown>();
  const values = job["input-values"];
  for (let i = 0; i < (values?.count ?? 0); i++) {
    const { key, value } = values!.get(i);
    const expression = (value as { expression?: string }).expression;
    given.set(
      key.toString().toLowerCase(),
      expression === undefined
        ? (value as { value?: unknown }).value
        : `\${{ ${expression} }}`,
    );
  }
  return new Map(
    [...callee.callInputs].map(([name, declared]) => {
      const lower = name.toLowerCase();
      return [
        lower,
        given.has(lower)
          ? given.get(lower)
          : (declared.default ?? UNSET[String(declared.type)] ?? ""),
      ];
    }),
  );
}
