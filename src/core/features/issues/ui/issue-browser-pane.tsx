import { useEffect, useRef, type ReactNode } from "react";
import { IssueDetail } from "./issue-detail";
/** Return focus to an issue's list row once the list has rendered it again. */
export function focusIssueRow(identifier: string) {
  let frames = 0;
  const attempt = () => {
    const row = document.getElementById(`issue-row-${identifier}`);
    if (row) row.focus();
    else if (frames++ < 120) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}
/** Keep the originating controls mounted while an issue is open. */
export function IssueBrowserPane({
  identifier,
  onClose,
  children,
}: {
  identifier: string | null;
  onClose: () => void | Promise<void>;
  children: ReactNode;
}) {
  const pane = useRef<HTMLElement>(null);
  useEffect(() => {
    if (identifier) {
      window.scrollTo(0, 0);
      pane.current?.focus();
    }
  }, [identifier]);
  async function close() {
    const id = identifier;
    await onClose();
    if (id) focusIssueRow(id);
  }
  return (
    <>
      <div hidden={identifier !== null}>{children}</div>
      {identifier && (
        <main
          ref={pane}
          className="direct-issue-page"
          tabIndex={-1}
          aria-label={`Issue ${identifier}`}
        >
          <IssueDetail identifier={identifier} onBack={close} />
        </main>
      )}
    </>
  );
}
