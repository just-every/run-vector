import { useHydrated } from '../../../app/initial-resources';
import { useEffect, useState, type RefObject } from "react";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { isEditableTarget } from "../../search/ui/command-helpers";
import { issueBranchName, issueEditFields, issueEditShortcuts, type BulkReceipt, type IssueEditField, type IssueEditTarget } from "./issue-keyboard-actions";
import { IssueKeyboardDialog } from "./issue-keyboard-dialog";
import { IssueKeyboardHelp } from "./issue-keyboard-help";
import { IssueKeyboardTeam } from "./issue-keyboard-team";
import { IssueKeyboardDuplicate } from "./issue-keyboard-duplicate";
import "./issue-keyboard.css";

export function IssueKeyboard({ root, rows, selection, focused, options, onRefresh, onSuccess }: {
  root: RefObject<HTMLElement | null>;
  rows: IssueEditTarget[];
  selection: Map<string, IssueEditTarget>;
  focused: string;
  options: WorkspaceOptions | null;
  onRefresh: () => void;
  onSuccess: (issues: BulkReceipt["issues"]) => void;
}) {
  const hydrated = useHydrated();
  const [edit, setEdit] = useState<{ field: IssueEditField; targets: IssueEditTarget[] } | null>(null);
  const [help, setHelp] = useState(false);
  const [team, setTeam] = useState<IssueEditTarget[] | null>(null);
  const [duplicate, setDuplicate] = useState<IssueEditTarget[] | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.defaultPrevented || event.repeat || event.altKey || isEditableTarget(target) ||
        !target || !root.current?.contains(target) || root.current.closest("[hidden]") ||
        target.closest("dialog, [role=dialog]") || edit || help || team || duplicate) return;
      if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault(); setHelp(true); return;
      }
      const focusedRow = target.closest("[data-issue-identifier]") ? rows.find((row) => row.identifier === focused) : null;
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
      if (!options || options.operator.role === 'viewer' || event.metaKey || event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "d" && event.shiftKey) {
        event.preventDefault();
        setNotice(null); setDuplicate(targets);
      } else if (key === "m") {
        event.preventDefault();
        setNotice(null); setTeam(targets);
      } else if (!event.shiftKey && issueEditShortcuts[key]) {
        event.preventDefault();
        setNotice(null);
        setEdit({ field: issueEditShortcuts[key]!, targets });
      }
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [root, rows, selection, focused, edit, help, team, duplicate, options]);
  function commandCompleted(receipt: BulkReceipt, action: string) {
    onSuccess(receipt.issues);
    setNotice({ error: false, text: `${receipt.changed} issues updated: ${action}.` });
    setTeam(null); setDuplicate(null); onRefresh();
  }
  return <>
    <button type="button" className="issue-keyboard-help-button" disabled={!hydrated} onClick={() => setHelp(true)}>Keyboard shortcuts (?)</button>
    {notice && <p role={notice.error ? "alert" : "status"}>{notice.text}</p>}
    {help && <IssueKeyboardHelp onClose={() => setHelp(false)} />}
    {team && <IssueKeyboardTeam targets={team} options={options} onClose={() => setTeam(null)} onSuccess={receipt => commandCompleted(receipt, "team")} />}
    {duplicate && <IssueKeyboardDuplicate targets={duplicate} limit={options?.bulkEditIssuesPerOperation} onClose={() => setDuplicate(null)} onSuccess={receipt => commandCompleted(receipt, "duplicate decision")} />}
    {edit && <IssueKeyboardDialog field={edit.field} targets={edit.targets} options={options} onClose={() => setEdit(null)}
      onSuccess={(receipt) => {
        onSuccess(receipt.issues);
        setNotice({ error: false, text: `${receipt.changed} issues updated: ${issueEditFields[edit.field].toLowerCase()}.` });
        setEdit(null);
        onRefresh();
      }} />}
  </>;
}
