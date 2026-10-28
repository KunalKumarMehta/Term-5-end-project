import { yaml } from "@codemirror/lang-yaml";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { WorkflowFile } from "../../src/core";

interface Props {
  file: WorkflowFile;
  onEdit: (path: string, text: string) => void;
}

/** One CodeMirror view; each file keeps its own state (undo history, selection) across tabs. */
export function Editor({ file, onEdit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const states = useRef(new Map<string, EditorState>());
  const edit = useRef(onEdit);

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

  return <div className="editor" ref={host} />;
}
