import { useEffect, useRef, type RefObject } from "react";

/** Survive the table's loading gap while preserving ownership of DOM focus. */
export function useIssueRowFocus(root: RefObject<HTMLElement | null>) {
  const owned = useRef<string | null>(null);
  useEffect(() => {
    const focusedIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const row = target?.closest<HTMLButtonElement>("button[data-issue-identifier]");
      owned.current = row && root.current?.contains(row) ? row.dataset.issueIdentifier ?? null : null;
    };
    const pointerDown = (event: PointerEvent) => {
      const row = event.target instanceof HTMLElement ? event.target.closest("button[data-issue-identifier]") : null;
      if (!row || !root.current?.contains(row)) owned.current = null;
    };
    const blurred = () => { owned.current = null; };
    document.addEventListener("focusin", focusedIn);
    document.addEventListener("pointerdown", pointerDown);
    window.addEventListener("blur", blurred);
    return () => {
      document.removeEventListener("focusin", focusedIn);
      document.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("blur", blurred);
    };
  }, [root]);
  return owned;
}
