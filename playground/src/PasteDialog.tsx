import { useEffect, useRef, useState } from "react";
import type { WorkflowFile } from "../../src/core";

const WORKFLOW_PATH = /^\.github\/workflows\/[^/]+\.ya?ml$/;

/** #12 addendum H: the first free name in untitled.yml, untitled-2.yml, untitled-3.yml… */
function defaultPath(files: WorkflowFile[]): string {
  for (let n = 1; ; n++) {
    const path = `.github/workflows/untitled${n === 1 ? "" : `-${n}`}.yml`;
    if (!files.some((f) => f.path === path)) return path;
  }
}

interface Props {
  files: WorkflowFile[];
  onAdd: (file: WorkflowFile) => void;
  onClose: () => void;
}

export function PasteDialog({ files, onAdd, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState(() => defaultPath(files));
  const [text, setText] = useState("");
  const [error, setError] = useState<"path" | "clash">();

  useEffect(() => {
    if (!dialog.current!.open) dialog.current!.showModal();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="paste-title" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!WORKFLOW_PATH.test(path)) setError("path");
          else if (files.some((f) => f.path === path)) setError("clash");
          else onAdd({ path, text });
        }}
      >
        <h2 id="paste-title">Paste a GitHub workflow</h2>
        <label htmlFor="paste-path">Path</label>
        <input
          id="paste-path"
          value={path}
          spellCheck={false}
          aria-invalid={error !== undefined}
          aria-describedby="paste-path-error"
          onChange={(e) => {
            setPath(e.target.value);
            setError(undefined);
          }}
        />
        <div id="paste-path-error" className="error">
          {error === "path" &&
            "Use a path like .github/workflows/ci.yml: WhyNoRun reads only .yml or .yaml files directly in .github/workflows/, as GitHub does."}
          {error === "clash" && (
            <>
              <code>{path}</code> is already in the Workflow set.{" "}
              <button type="button" onClick={() => onAdd({ path, text })}>
                Replace it
              </button>
            </>
          )}
        </div>
        <label htmlFor="paste-yaml">YAML</label>
        <textarea
          id="paste-yaml"
          rows={12}
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row">
          <button type="submit">Add file</button>
          <button type="button" onClick={() => dialog.current!.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
