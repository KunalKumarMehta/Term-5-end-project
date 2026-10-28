import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  RULES,
  validateScenario,
  type Cause,
  type SettleHint,
  type Span,
  type Verdict,
  type WorkflowFile,
} from "../../src/core";

export const OWNER_REPO_ERROR = "Use the form owner/repo, e.g. acme/app";

/** #12 addendum B: the Scenario schema's owner/repo check, wherever owner/repo is entered. */
export const isOwnerRepo = (value: string) =>
  validateScenario({
    event: { name: "push" },
    repo: { date: "2000-01-01", repository: value },
  }).length === 0;

/** A settle value as an expression would write it: `'true'`, `false`, `['a', 'b']`. */
export const literal = (value: unknown): string =>
  typeof value === "string"
    ? `'${value}'`
    : Array.isArray(value)
      ? `[${value.map(literal).join(", ")}]`
      : typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value);

/** #12 §6: free text read for its path, so it is never invalid (owner/repo aside). */
function parse(path: string, text: string): unknown {
  if (!path.startsWith("github.event.")) return text;
  if (path.includes(".*.")) return text.split("\n").filter((l) => l !== "");
  if (text === "true" || text === "false") return text === "true";
  if (text === "null") return null;
  return text.trim() !== "" && Number.isFinite(Number(text))
    ? Number(text)
    : text;
}

/** Renders `code` spans in the core's prose as code, and everything else as text. */
export function prose(text: string): ReactNode {
  return text
    .split("`")
    .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

export const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

// The Scenario inputs that have a form field so far; the others arrive with their tickets.
const FIELDS: Record<string, { id: string; label: string }> = {
  "event.name": { id: "event-name", label: "Event name" },
  "event.type": { id: "event-type", label: "Activity type" },
  "event.actor": { id: "event-actor", label: "Actor kind" },
  "event.approval": { id: "event-approval", label: "Approval" },
  "event.ref": { id: "event-ref", label: "Ref" },
  "event.base": { id: "event-base", label: "Base branch" },
  "event.changed": { id: "event-changed", label: "Changed files" },
  "event.message": { id: "event-message", label: "Head commit message" },
  "event.login": { id: "event-login", label: "Actor login" },
  "repo.date": { id: "sim-date", label: "Simulation date" },
  "repo.visibility": { id: "repo-visibility", label: "Visibility" },
  "repo.predates": { id: "repo-predates", label: "Created before 2026-09-17" },
  "repo.defaultBranch": { id: "repo-default-branch", label: "Default branch" },
  "repo.tokenDefault": { id: "repo-token-default", label: "Token default" },
  "repo.eventPolicy": { id: "repo-event-policy", label: "Event policy" },
  "repo.repository": { id: "repo-repository", label: "owner/repo" },
};

/** A span's last line, leaving out a line the span only reaches at its first column. */
export const lastLine = (span: Span) =>
  span.endLine > span.line && span.endCol === 1
    ? span.endLine - 1
    : span.endLine;

export interface CauseLinks {
  files: WorkflowFile[];
  focusField: (id: string) => void;
  /** A Repo fact's source tag (#9 §6); undefined for inputs that carry none. */
  source: (path: string) => "assumed" | "set" | undefined;
  showLines: (span: Span) => void;
}

/** #9 §1: the ordered cause chain, root first, each with its rule, YAML lines and inputs. */
export function Causes({
  causes,
  files,
  focusField,
  source,
  showLines,
}: { causes: Cause[] } & CauseLinks) {
  return (
    <ol className="explanation" aria-label="Causes">
      {causes.map((cause, i) =>
        cause.rule === "WN-5" ? (
          // #9 §6: an assumed default, grey after the root, with a link to set it.
          <li key={i} className="assumed-cause">
            {cause.inputs.map(({ path, value }) => {
              const field = FIELDS[path];
              return (
                <Fragment key={path}>
                  WN-5: {field?.label ?? path} = {String(value)} (assumed
                  default){" "}
                  {field && (
                    <a
                      href={`#${field.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        focusField(field.id);
                      }}
                    >
                      set it
                    </a>
                  )}
                </Fragment>
              );
            })}
          </li>
        ) : (
          <li key={i}>
            {i === 0 && <span className="root">root </span>}
            {cause.rule}: {prose(RULES[cause.rule]?.text ?? "")}
            {cause.spans.map((span, j) => (
              <Excerpt
                key={j}
                span={span}
                files={files}
                showLines={showLines}
              />
            ))}
            <ul>
              {cause.inputs.map(({ path, value }) => {
                const field = FIELDS[path];
                const text = `${field?.label ?? path} = ${String(value)}`;
                const tag = source(path);
                return (
                  <li key={path}>
                    {field ? (
                      <a
                        href={`#${field.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(field.id);
                        }}
                      >
                        {text}
                      </a>
                    ) : (
                      text
                    )}
                    {tag && (
                      <>
                        {" "}
                        <span className={`source-tag ${tag}`}>{tag}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ),
      )}
    </ol>
  );
}

/** The span's lines with one line of context either side, and its `file:line` link. */
function Excerpt({
  span,
  files,
  showLines,
}: {
  span: Span;
  files: WorkflowFile[];
  showLines: (span: Span) => void;
}) {
  const end = lastLine(span);
  const label = `${basename(span.path)}:${span.line}${end > span.line ? `–${end}` : ""}`;
  const lines = files.find((f) => f.path === span.path)?.text.split("\n");
  if (!lines) return <p className="key">{label}</p>;
  const from = Math.max(1, span.line - 1);
  const to = Math.min(lines.length, end + 1);
  return (
    <div className="excerpt">
      <a
        href="#"
        className="key"
        onClick={(e) => {
          e.preventDefault();
          showLines(span);
        }}
      >
        {label}
      </a>
      <pre>
        {lines.slice(from - 1, to).map((text, k) => {
          const n = from + k;
          const own = n >= span.line && n <= end;
          return (
            <span key={n} className="line">
              <span className="ln" aria-hidden>
                {n}
              </span>
              {own ? <mark>{text}</mark> : text}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

/**
 * Stores a settle path's value in the Scenario the Verdict belongs to; returns why it
 * refused, leaving the Scenario unchanged.
 */
export type OnSettle = (path: string, value: unknown) => string | undefined;

/** #9 §7: the box at the end of an Uncertain Verdict's Explanation. */
function SettleIt({
  verdict,
  onSettle,
}: {
  verdict: Verdict;
  onSettle: OnSettle;
}) {
  const settle = verdict.settle ?? [];
  const root = verdict.causes[0]?.rule;
  return (
    <section className="settle" aria-label="Settle it">
      <h3>Settle it</h3>
      {settle.length === 0 ? (
        <p>
          Nothing you can enter decides this:{" "}
          {root === "WN-4"
            ? "the value exists only at run time."
            : `a gap in GitHub's docs (${root}).`}
        </p>
      ) : (
        <ul>
          {settle.map((path) => (
            <SettlePath
              key={path}
              path={path}
              hint={verdict.hints?.find((h) => h.path === path)}
              onSettle={onSettle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SettlePath({
  path,
  hint,
  onSettle,
}: {
  path: string;
  hint: SettleHint | undefined;
  onSettle: OnSettle;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const list = path.includes(".*.");
  const repository = path === "repo.repository";
  // A candidate owner/repo literal that fails the check gets no button (#12 addendum B).
  const candidates = (hint?.candidates ?? []).filter(
    (c) => !repository || (typeof c === "string" && isOwnerRepo(c)),
  );
  const submit = () => {
    if (repository && !isOwnerRepo(text)) return setError(OWNER_REPO_ERROR);
    setError(onSettle(path, parse(path, text)));
  };
  const field = {
    id,
    value: text,
    "aria-invalid": error !== undefined,
    "aria-describedby": `${id}-error`,
  };
  return (
    <li>
      <p>
        <code>{path}</code>
        {hint && <>: {prose(hint.text)}</>}
      </p>
      <div className="row">
        {candidates.map((c) => (
          <button
            key={literal(c)}
            type="button"
            onClick={() => setError(onSettle(path, list ? [c] : c))}
          >
            {literal(c)}
          </button>
        ))}
      </div>
      <label htmlFor={id}>
        {list ? "Values, one per line" : "Another value"}
      </label>
      <div className="row">
        {list ? (
          <textarea
            {...field}
            rows={2}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <input
            {...field}
            onChange={(e) => {
              setText(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        )}
        <button type="button" onClick={submit}>
          Settle
        </button>
      </div>
      <p id={`${id}-error`} className="error" role="alert">
        {error}
      </p>
    </li>
  );
}

/**
 * The Explanation panel; a full-screen sheet on narrow screens (#12 §10). It shows the
 * open Verdict as the latest run gives it, so it updates after any re-simulation.
 */
export function Explanation({
  subject,
  scenario,
  verdict,
  onClose,
  sheet,
  onScroll,
  onSettle,
  ...links
}: {
  subject: string;
  /** With Compare on, the label of the Scenario the Verdict belongs to. */
  scenario?: string;
  verdict: Verdict | undefined;
  onClose: () => void;
  sheet: Ref<HTMLElement>;
  onScroll: (top: number) => void;
  onSettle: OnSettle;
} & CauseLinks) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [subject, scenario]);

  return (
    <section
      className="explanation-panel"
      aria-label="Explanation"
      ref={sheet}
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
    >
      <div className="row">
        <h2 ref={heading} tabIndex={-1}>
          {scenario && <>{scenario}: </>}
          <span className="key">{subject}</span>
          {verdict && <> {verdict.value}</>}
        </h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {verdict ? (
        <>
          <Causes causes={verdict.causes} {...links} />
          {verdict.value === "uncertain" && (
            <SettleIt verdict={verdict} onSettle={onSettle} />
          )}
        </>
      ) : (
        <p>The latest results have no Verdict for this subject.</p>
      )}
    </section>
  );
}
