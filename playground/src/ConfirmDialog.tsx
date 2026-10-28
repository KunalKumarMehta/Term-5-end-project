import { useEffect, useRef } from "react";

export interface Confirm {
  title: string;
  /** What will be lost, one sentence each. */
  losses: string[];
  /** The button that goes ahead, such as "Load example". */
  action: string;
  run: () => void;
}

interface Props {
  confirm: Confirm;
  onClose: (accepted: boolean) => void;
}

/**
 * The confirm-first rule (#12 §1, #14 §10): an alertdialog that starts on Keep my draft.
 * Escape, tapping outside and Back (a close request) all keep the draft.
 */
export function ConfirmDialog({ confirm, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const accepted = useRef(false);

  useEffect(() => {
    if (!dialog.current!.open) dialog.current!.showModal();
    keep.current!.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-losses"
      className="confirm"
      onClose={() => onClose(accepted.current)}
      // The dialog box itself has no padding, so a click on the dialog element is on its backdrop.
      onClick={(e) => e.target === e.currentTarget && dialog.current!.close()}
    >
      <div>
        <h2 id="confirm-title">{confirm.title}</h2>
        <div id="confirm-losses">
          {confirm.losses.map((loss) => (
            <p key={loss}>{loss}</p>
          ))}
          <p>There is no undo.</p>
        </div>
        <div className="row">
          <button
            ref={keep}
            type="button"
            onClick={() => dialog.current!.close()}
          >
            Keep my draft
          </button>
          <button
            type="button"
            onClick={() => {
              accepted.current = true;
              dialog.current!.close();
            }}
          >
            {confirm.action}
          </button>
        </div>
      </div>
    </dialog>
  );
}
