import { useEffect, useRef, type ReactNode } from "react";

export function IssueKeyboardModal({ title, busy = false, onClose, children }: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rowId = previous?.closest("[data-issue-identifier]")?.id;
    node?.showModal();
    return () => {
      node?.close();
      // An applied status can reparent the row into another group. Its old
      // button is gone, but the same issue must regain keyboard ownership.
      const target = previous?.isConnected ? previous : rowId ? document.getElementById(rowId) : null;
      if (target && !target.closest("[hidden]")) target.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className="issue-keyboard-dialog" aria-label={title}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onClose();
        }
      }}>
      <h2>{title}</h2>
      {children}
      <button type="button" disabled={busy} onClick={onClose}>Close</button>
    </dialog>
  );
}
