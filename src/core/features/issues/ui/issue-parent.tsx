import { Link } from "@tanstack/react-router";
import { useState, type Ref } from "react";
import type { IssueDetailData } from "./data";
import { IssueParentPicker } from "./issue-parent-picker";
import "./issue-parent.css";

export type HierarchyState = { editing: boolean; message: string };
/** Keep empty hierarchies compact while preserving the sub-issue entry. */
export function hierarchyIsEmpty(issue: IssueDetailData, state: HierarchyState) {
  return !issue.parent && !issue.children.length && !state.editing && !state.message;
}
export function IssueParent({
  issue,
  onRefresh,
  state,
  onState,
  compact = false,
  triggerRef,
  writable = true,
}: {
  writable?: boolean;
  issue: IssueDetailData;
  onRefresh: () => void;
  state: HierarchyState;
  onState: (state: HierarchyState) => void;
  compact?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const [receipt, setReceipt] = useState<IssueDetailData | null>(null);
  const editing = state.editing,
    receiptMessage = state.message;
  const setEditing = (next: boolean) => onState({ ...state, editing: next });
  const current =
    receipt?.identifier === issue.identifier && receipt.version >= issue.version
      ? receipt
      : issue;

  function saveReceipt(updated: IssueDetailData, parentIdentifier: string | null) {
    setReceipt(updated);
    onState({
      editing: false,
      message:
        parentIdentifier === null
          ? "Parent cleared."
          : `Parent set to ${updated.parent?.identifier ?? parentIdentifier}.`,
    });
    onRefresh();
  }

  if (compact)
    return (
      <section
        className="issue-parent issue-parent--compact"
        aria-label="Issue hierarchy"
      >
        <button
          type="button"
          ref={triggerRef}
          className="issue-parent__edit"
          aria-expanded={false}
          onClick={() => onState({ editing: true, message: "" })}
        >
          Set parent
        </button>
      </section>
    );
  return (
    <section className="issue-parent" aria-label="Issue hierarchy">
      <div className="issue-parent__top">
        {current.parent ? (
          <div className="issue-parent__current">
            <span className="issue-parent__label">Parent</span>
            <Link
              className="issue-parent__link"
              to="/app/issues/$identifier"
              params={{ identifier: current.parent.identifier }}
              aria-label={`Parent ${current.parent.identifier}: ${current.parent.title}, status ${current.parent.status.name}`}
            >
              <strong>{current.parent.identifier}</strong>
              <span className="issue-parent__title">
                {current.parent.title}
              </span>
              <span className="issue-parent__status">
                {current.parent.status.name}
              </span>
            </Link>
          </div>
        ) : null}
        <button
          type="button"
          ref={triggerRef}
          className="issue-parent__edit"
          aria-expanded={editing}
          disabled={!writable || editing}
          onClick={() => onState({ editing: true, message: "" })}
        >
          {editing
            ? "Parent editor open"
            : current.parent
              ? "Change parent"
              : "Set parent"}
        </button>

      </div>

      {writable && editing ? (
        <IssueParentPicker
          key={issue.identifier}
          issue={current}
          onCancel={() => setEditing(false)}
          onSaved={saveReceipt}
          onRefresh={onRefresh}
        />
      ) : null}
      {receiptMessage ? (
        <p className="issue-parent__message" role="status">
          {receiptMessage}
        </p>
      ) : null}
    </section>
  );
}
