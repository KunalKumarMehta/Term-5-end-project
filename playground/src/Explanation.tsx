import { useEffect, useRef, type ReactNode, type Ref } from "react";
import {
  RULES,
  type Cause,
  type Span,
  type Verdict,
  type WorkflowFile,
} from "../../src/core";

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
  "event.ref": { id: "event-ref", label: "Ref" },
  "event.base": { id: "event-base", label: "Base branch" },
  "event.changed": { id: "event-changed", label: "Changed files" },
  "event.message": { id: "event-message", label: "Head commit message" },
  "repo.date": { id: "sim-date", label: "Simulation date" },
};

/** A span's last line, leaving out a line the span only reaches at its first column. */
export const lastLine = (span: Span) =>
  span.endLine > span.line && span.endCol === 1
    ? span.endLine - 1
    : span.endLine;

export interface CauseLinks {
  files: WorkflowFile[];
  focusField: (id: string) => void;
  showLines: (span: Span) => void;
}

/** #9 §1: the ordered cause chain, root first, each with its rule, YAML lines and inputs. */
export function Causes({
  causes,
  files,
  focusField,
  showLines,
}: { causes: Cause[] } & CauseLinks) {
  return (
    <ol className="explanation" aria-label="Causes">
      {causes.map((cause, i) => (
        <li key={i}>
          {i === 0 && <span className="root">root </span>}
          {cause.rule}: {prose(RULES[cause.rule]?.text ?? "")}
          {cause.spans.map((span, j) => (
            <Excerpt key={j} span={span} files={files} showLines={showLines} />
          ))}
          <ul>
            {cause.inputs.map(({ path, value }) => {
              const field = FIELDS[path];
              const text = `${field?.label ?? path} = ${String(value)}`;
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
                </li>
              );
            })}
          </ul>
        </li>
      ))}
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
  ...links
}: {
  subject: string;
  /** With Compare on, the label of the Scenario the Verdict belongs to. */
  scenario?: string;
  verdict: Verdict | undefined;
  onClose: () => void;
  sheet: Ref<HTMLElement>;
  onScroll: (top: number) => void;
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
        <Causes causes={verdict.causes} {...links} />
      ) : (
        <p>The latest results have no Verdict for this subject.</p>
      )}
    </section>
  );
}
