import { yaml } from "@codemirror/lang-yaml";
import {
  EditorState,
  StateEffect,
  StateField,
  type Range,
} from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { Span, WorkflowFile } from "../../src/core";
import { lastLine } from "./Explanation";

interface Props {
  file: WorkflowFile;
  onEdit: (path: string, text: string) => void;
  /** Lines a `file:line` link showed; highlighted when they're in this file. */
  highlight?: Span;
}

const showLines = StateEffect.define<{ from: number; to: number }>();

/** The highlighted lines, which follow edits until another `file:line` link replaces them. */
const highlighted = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, tr) {
    lines = lines.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(showLines)) continue;
      const marks: Range<Decoration>[] = [];
      for (let n = effect.value.from; n <= effect.value.to; n++)
        marks.push(
          Decoration.line({ class: "highlighted" }).range(
            tr.state.doc.line(n).from,
          ),
        );
      lines = Decoration.set(marks);
    }
    return lines;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** One CodeMirror view; each file keeps its own state (undo history, selection) across tabs. */
export function Editor({ file, onEdit, highlight }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const states = useRef(new Map<string, EditorState>());
  const edit = useRef(onEdit);
  const shown = useRef<Span>(undefined);

  useEffect(() => {
    edit.current = onEdit;
  }, [onEdit]);

  useEffect(() => {
    const created = new EditorView({ parent: host.current! });
    view.current = created;
    return () => created.destroy();
  }, []);

  useEffect(() => {
    const { path, text } = file;
    let state = states.current.get(path);
    // A file replaced from outside the editor (Paste's Replace it) starts a fresh state.
    if (state?.doc.toString() !== text) {
      state = EditorState.create({
        doc: text,
        extensions: [
          basicSetup,
          yaml(),
          highlighted,
          EditorView.contentAttributes.of({ "aria-label": `YAML of ${path}` }),
          // #12 §5: dropping files is the page's job, never an insert into the editor.
          EditorView.domEventHandlers({
            drop: (event) => {
              event.preventDefault();
              return true;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            states.current.set(path, update.state);
            edit.current(path, update.state.doc.toString());
          }),
        ],
      });
      states.current.set(path, state);
    }
    if (view.current!.state !== state) view.current!.setState(state);
  }, [file]);

  useEffect(() => {
    if (
      !highlight ||
      highlight === shown.current ||
      highlight.path !== file.path
    )
      return;
    shown.current = highlight;
    const { doc } = view.current!.state;
    // The YAML may have changed since the run the link came from.
    const from = Math.min(highlight.line, doc.lines);
    const to = Math.min(Math.max(lastLine(highlight), from), doc.lines);
    view.current!.dispatch({
      effects: [
        showLines.of({ from, to }),
        EditorView.scrollIntoView(doc.line(from).from, { y: "center" }),
      ],
    });
  }, [highlight, file.path]);

  return <div className="editor" ref={host} />;
}
