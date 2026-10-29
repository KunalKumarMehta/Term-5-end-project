import { useEffect, useRef } from "react";
import { MAX_LINK } from "./link";

// Slack advises 4,000, and Safari's address bar showed only about 4,096 (#14 §8).
const LONG = 4000;

interface Props {
  /** The full link, or undefined while it's being written. */
  url?: string;
  /** Why no link can be offered, when its own checks would refuse it. */
  error?: string;
  /** For the message when it's too big: an edited import's reference, if any. */
  reference?: string;
  /** Whether the tray has pins, the only time a Test file is mentioned. */
  pins: boolean;
  onCopied: () => void;
  onClose: () => void;
}

/** #14 §8: the share popover, with the link, Copy, and the long-link warning or refusal. */
export function ShareDialog({
  url,
  error,
  reference,
  pins,
  onCopied,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dialog.current!.open) dialog.current!.showModal();
  }, []);

  const copy = () =>
    navigator.clipboard.writeText(url!).then(
      () => {
        onCopied();
        dialog.current!.close();
      },
      // Clipboard access denied: the field is selected for the Maintainer to copy.
      () => {
        field.current!.focus();
        field.current!.select();
      },
    );

  const n = url?.length ?? 0;
  return (
    <dialog ref={dialog} aria-labelledby="share-title" onClose={onClose}>
      <h2 id="share-title">Share link</h2>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : url === undefined ? (
        <p>Writing the link…</p>
      ) : n > MAX_LINK ? (
        <p className="error" role="alert">
          Too big for a link.{" "}
          {reference ? (
            <>
              Undo your edits to share <code>{reference}</code>, or share the
              edited files themselves.
            </>
          ) : (
            <>
              Share the <code>.github/workflows</code> files themselves.
            </>
          )}
          {pins && " A Test file shares the Scenarios and pins."}
        </p>
      ) : (
        <>
          <label htmlFor="share-link">Link</label>
          <input
            ref={field}
            id="share-link"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="hint">
            Anyone with this link sees these files and Scenarios
          </p>
          {n > LONG && (
            <p className="error">
              Long link ({n.toLocaleString("en")} characters): some chat apps
              cut links over 4,000
            </p>
          )}
        </>
      )}
      <div className="row">
        {url !== undefined && n <= MAX_LINK && (
          <button type="button" onClick={() => void copy()}>
            {n > LONG ? "Copy anyway" : "Copy"}
          </button>
        )}
        <button type="button" onClick={() => dialog.current!.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
