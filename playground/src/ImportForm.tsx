import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { OWNER_REPO_ERROR, isOwnerRepo } from "./Explanation";
import { importRepo, type Failure, type Imported } from "./importRepo";

// Only the owner and repo are read from a link, never a ref: branch names can hold "/" (#7).
const LINK = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/i;
// #12 §6: only obvious garbage; whether the ref exists is GitHub's to say.
const GARBAGE = /[\s~^:?*[\\]|\.\./;

const INSTEAD = " Paste or upload instead.";

interface Props {
  /** The owner/repo and ref to start from: a Re-import's. */
  initial?: { name: string; ref: string };
  announce: (message: string) => void;
  /** The import starts fetching. */
  onStart: () => void;
  /** Every file has arrived; `focused` says whether focus was still on Cancel. */
  onImported: (got: Imported, focused: boolean) => void;
  onClose: () => void;
}

/**
 * #86: the import form in the header. While it fetches it becomes a step line with Cancel, and
 * the current set stays usable; it ends in success, Cancel or a message under its field.
 */
export function ImportForm({
  initial,
  announce,
  onStart,
  onImported,
  onClose,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ref, setRef] = useState(initial?.ref ?? "");
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<
    Failure | { kind: "name" } | { kind: "garbage" }
  >();
  const running = useRef<AbortController>(undefined);
  const cancel = useRef<HTMLButtonElement>(null);
  // What to focus after the next render: a field, Cancel, Retry or Import (#12 addendum E).
  const [focus, setFocus] = useState<{ id: string }>();
  // The latest callback, as an import outlives the render that started it.
  const imported = useRef(onImported);
  useLayoutEffect(() => {
    imported.current = onImported;
  });

  useEffect(() => {
    document.getElementById("import-repo")?.focus();
    return () => running.current?.abort();
  }, []);

  useEffect(() => {
    if (focus) document.getElementById(focus.id)?.focus();
  }, [focus]);

  const start = async () => {
    setError(undefined);
    const link = LINK.exec(name.trim());
    const full = link
      ? `${link[1]}/${link[2]!.replace(/\.git$/, "")}`
      : name.trim();
    if (!isOwnerRepo(full)) {
      setError({ kind: "name" });
      return setFocus({ id: "import-repo" });
    }
    if (GARBAGE.test(ref)) {
      setError({ kind: "garbage" });
      return setFocus({ id: "import-ref" });
    }
    const [owner, repo] = full.split("/") as [string, string];
    const controller = new AbortController();
    running.current = controller;
    setStep("Resolving ref…");
    setFocus({ id: "import-cancel" });
    announce(`Importing ${full}…`);
    onStart();
    let got: Imported | Failure;
    try {
      got = await importRepo(
        owner,
        repo,
        ref.trim(),
        // A cancelled or failed import's last steps (a download still in flight) never bring the step line back.
        (text) => running.current !== controller || setStep(text),
        controller.signal,
      );
    } catch {
      return; // Cancelled: Cancel has done the rest.
    }
    const focused = document.activeElement === cancel.current;
    running.current = undefined;
    setStep(undefined);
    if ("files" in got) return imported.current(got, focused);
    setError(got);
    if (focused)
      setFocus({
        id:
          got.kind === "network"
            ? "import-retry"
            : got.kind === "repo" || got.kind === "rate"
              ? "import-repo"
              : "import-ref",
      });
  };

  if (step !== undefined)
    return (
      <form className="import" aria-label="Import a public repo">
        <span>{step}</span>
        <button
          id="import-cancel"
          ref={cancel}
          type="button"
          onClick={() => {
            running.current?.abort();
            running.current = undefined;
            setStep(undefined);
            setFocus({ id: "import-submit" });
          }}
        >
          Cancel
        </button>
      </form>
    );

  const kind = error?.kind;
  return (
    <form
      className="import"
      aria-label="Import a public repo"
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <label htmlFor="import-repo">owner/repo or github.com link</label>
      <input
        id="import-repo"
        spellCheck={false}
        value={name}
        aria-invalid={kind === "name" || kind === "repo"}
        aria-describedby="import-repo-error"
        onChange={(e) => setName(e.target.value)}
      />
      <p id="import-repo-error" className="error" role="alert">
        {kind === "name" && OWNER_REPO_ERROR}
        {kind === "repo" &&
          `Not found or private. Private repos aren’t supported.${INSTEAD}`}
        {error?.kind === "rate" &&
          `GitHub allows 60 requests an hour without sign-in, and they’re used up${
            error.reset
              ? ` until ${error.reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""
          }.${INSTEAD}`}
      </p>
      <label htmlFor="import-ref">
        Ref <span className="optional">(optional)</span>
      </label>
      <input
        id="import-ref"
        spellCheck={false}
        placeholder="default branch"
        value={ref}
        aria-invalid={kind === "garbage" || kind === "ref"}
        aria-describedby="import-ref-error"
        onChange={(e) => setRef(e.target.value)}
      />
      <p id="import-ref-error" className="error" role="alert">
        {kind === "garbage" &&
          "A ref can’t contain spaces, .. or any of ~^:?*[\\"}
        {kind === "ref" && (
          <>
            No branch, tag or commit named <code>{ref.trim()}</code>.{INSTEAD}
          </>
        )}
        {(kind === "folder" || kind === "none") &&
          (kind === "folder" ? (
            `No GitHub workflows at this ref.${INSTEAD}`
          ) : (
            <>
              No <code>.yml</code>/<code>.yaml</code> files directly in{" "}
              <code>.github/workflows/</code>.{INSTEAD}
            </>
          ))}
      </p>
      <div className="row">
        <button id="import-submit" type="submit">
          Import
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p id="import-error" className="error" role="alert">
        {error?.kind === "network" && (
          <>
            Couldn’t reach GitHub
            {error.status === undefined ? "" : ` (${error.status})`}.{" "}
            <button
              id="import-retry"
              type="button"
              onClick={() => void start()}
            >
              Retry
            </button>
            {INSTEAD}
          </>
        )}
      </p>
    </form>
  );
}
