import { useHydrated } from '../../../app/initial-resources';
import { useEffect, useState, type RefObject } from "react";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { isEditableTarget } from "../../search/ui/command-helpers";
import { issueBranchName, issueEditFields, issueEditShortcuts, type BulkReceipt, type IssueEditField, type IssueEditTarget } from "./issue-keyboard-actions";
import { IssueKeyboardDialog } from "./issue-keyboard-dialog";
import { IssueKeyboardHelp } from "./issue-keyboard-help";
import { IssueKeyboardTeam } from "./issue-keyboard-team";
import type { IssueRow } from "./issue-selection";
import "./issue-keyboard.css";

export function IssueKeyboard({ root, rows, selection, focused, options, onRefresh, onSuccess }: {
  root: RefObject<HTMLElement | null>;
  rows: IssueRow[];
  selection: Map<string, IssueRow>;
  focused: string;
  options: WorkspaceOptions | null;
  onRefresh: () => void;
  onSuccess: (issues: BulkReceipt["issues"]) => void;
}) {
  const hydrated = useHydrated();
  const [edit, setEdit] = useState<{ field: IssueEditField; targets: IssueEditTarget[] } | null>(null);
  const [help, setHelp] = useState(false);
  const [team, setTeam] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.defaultPrevented || event.repeat || event.altKey || isEditableTarget(target) ||
        !target || !root.current?.contains(target) || root.current.closest("[hidden]") ||
        target.closest("dialog, [role=dialog]") || edit || help || team) return;
      if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault(); setHelp(true); return;
      }
      const focusedRow = target.closest(".issues-row") ? rows.find((row) => row.identifier === focused) : null;
      const targets = selection.size ? [...selection.values()] : focusedRow ? [focusedRow] : [];
      if (!targets.length) return;
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        void (async () => {
          try {
            await navigator.clipboard.writeText(targets.map(issueBranchName).join("\n"));
            setNotice({ error: false, text: `${targets.length} branch ${targets.length === 1 ? "name" : "names"} copied.` });
          } catch (cause) {
            setNotice({ error: true, text: `Could not copy branch names. ${cause instanceof Error ? cause.message : "Clipboard access failed."}` });
          }
        })();
        return;
      }
      if (event.metaKey || event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "d" && event.shiftKey) {
        event.preventDefault();
        setNotice({ error: true, text: "The duplicate shortcut is not available yet. Open an issue with Enter and use its Duplicates action." });
      } else if (key === "m") {
        event.preventDefault();
        if (targets.length === 1) setTeam(targets[0]!.identifier);
        else setNotice({ error: true, text: "Move team currently supports one issue at a time. Keep one issue selected, or clear selection and focus one row." });
      } else if (!event.shiftKey && issueEditShortcuts[key]) {
        event.preventDefault();
        setNotice(null);
        setEdit({ field: issueEditShortcuts[key]!, targets });
      }
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [root, rows, selection, focused, edit, help, team]);
  return <>
    <button type="button" className="issue-keyboard-help-button" disabled={!hydrated} onClick={() => setHelp(true)}>Keyboard shortcuts (?)</button>
    {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    {help && <IssueKeyboardHelp onClose={() => setHelp(false)} />}
    {team && <IssueKeyboardTeam identifier={team} options={options} onClose={() => setTeam(null)} onRefresh={onRefresh} />}
    {edit && <IssueKeyboardDialog field={edit.field} targets={edit.targets} options={options} onClose={() => setEdit(null)}
      onSuccess={(receipt) => {
        onSuccess(receipt.issues);
        setNotice({ error: false, text: `${receipt.changed} issues updated: ${issueEditFields[edit.field].toLowerCase()}.` });
        setEdit(null);
        onRefresh();
      }} />}
  </>;
}
