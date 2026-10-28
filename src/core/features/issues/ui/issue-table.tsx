import { useDateFormat } from "../../../shared/date-format";
import { ManualOrderControls } from '../../manual-order/ui/controls';
import { useManualOrder } from '../../manual-order/ui/context';
import { useHydrated } from '../../../app/initial-resources';
import { useLayoutEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { IssueListData } from "../list-schema";
import {
  issueGroups,
  toggleIssueSelection,
  type IssueRow,
} from "./issue-selection";
export function IssueTable({
  data,
  grouping,
  selection,
  setSelection,
  onOpen,
  focused,
  setFocused,
  ownedFocus,
  rowAction,
}: {
  data: IssueListData;
  grouping: string;
  selection: Map<string, IssueRow>;
  setSelection: Dispatch<SetStateAction<Map<string, IssueRow>>>;
  onOpen: (id: string) => void;
  focused: string;
  setFocused: (id: string) => void;
  ownedFocus: { current: string | null };
  rowAction?: (issue: IssueListData["issues"][number]) => ReactNode;
}) {
  const hydrated = useHydrated();
  const { date } = useDateFormat();
  const manual = useManualOrder();
  const table = useRef<HTMLDivElement>(null);
  const groups = issueGroups(data, grouping);
  const ordered = groups.flatMap((group) => group.issues);
  useLayoutEffect(() => {
    const next = ordered.some((row) => row.identifier === focused) ? focused : ordered[0]?.identifier ?? "";
    if (next !== focused) setFocused(next);
    // Re-grouping can replace a row's DOM node. Restore only focus actually
    // owned by a row; filters, dialogs and other controls keep their focus.
    if (ownedFocus.current && !table.current?.closest("[hidden]")) {
      const retained = ordered.some((row) => row.identifier === ownedFocus.current) ? ownedFocus.current : next;
      if (retained) document.getElementById(`issue-row-${retained}`)?.focus();
      else ownedFocus.current = null;
    }
  }, [data, grouping, focused, setFocused, ownedFocus]);
  function keyDown(event: React.KeyboardEvent, row: IssueRow) {
    if (manual && event.target === event.currentTarget && event.altKey && ['ArrowUp','ArrowDown','Home'].includes(event.key)) {
      event.preventDefault(); manual.move(row, event.key === 'Home' ? 'top' : event.key === 'ArrowUp' ? 'up' : 'down'); return;
    }
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "x" || event.key === "X") {
      event.preventDefault();
      setSelection((current) => toggleIssueSelection(current, row));
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = ordered.findIndex(
          (r) => r.identifier === row.identifier,
        ),
        next =
          ordered[
            Math.max(
              0,
              Math.min(
                ordered.length - 1,
                index + (event.key === "ArrowDown" ? 1 : -1),
              ),
            )
          ];
      if (next) {
        setFocused(next.identifier);
        document.getElementById(`issue-row-${next.identifier}`)?.focus();
      }
    }
  }
  return (
    <div ref={table}>
      {data.issues.length > 0 && (
        <label className="issues-select-page">
          <input
            type="checkbox"
            disabled={!hydrated}
            checked={data.issues.every((r) => selection.has(r.identifier))}
            onChange={(e) =>
              setSelection((current) => {
                const next = new Map(current);
                data.issues.forEach((r) => {
                  if (e.target.checked) next.set(r.identifier, r);
                  else next.delete(r.identifier);
                });
                return next;
              })
            }
          />
          Select this page
        </label>
      )}
      {groups.map((group) => (
        <section className="issues-group" key={group.key}>
          {grouping !== "none" && (
            <h2>
              {group.name}{" "}
              <span>
                {group.issues.length < group.count
                  ? `Showing ${group.issues.length} of ${group.count}`
                  : group.count}
              </span>
            </h2>
          )}
          <div className="issues-table">
            {group.issues.length > 0 && (
              <div className="issues-columns" aria-hidden="true">
                <span>Issue</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Team</span>
                <span>Assignee</span>
              </div>
            )}
            <ul>
              {group.issues.map((issue) => (
                <li key={issue.id} className="issues-selectable">
                  <label className="issues-selection">
                    <input
                      type="checkbox"
                      disabled={!hydrated}
                      aria-label={`Select ${issue.identifier}`}
                      checked={selection.has(issue.identifier)}
                      onChange={() =>
                        setSelection((current) =>
                          toggleIssueSelection(current, issue),
                        )
                      }
                    />
                  </label>
                  <button
                    disabled={!hydrated}
                    className={`issues-row${focused === issue.identifier ? " is-focused" : ""}`}
                    id={`issue-row-${issue.identifier}`}
                    data-issue-identifier={issue.identifier}
                    tabIndex={issue.identifier === (focused || ordered[0]?.identifier) ? 0 : -1}
                    onFocus={() => setFocused(issue.identifier)}
                    onKeyDown={(event) => keyDown(event, issue)}
                    onClick={() => onOpen(issue.identifier)}
                  >
                    <span className="issues-title">
                      <span className="issues-identifier">
                        {issue.identifier}
                      </span>
                      <strong>{issue.title}</strong>
                      {issue.checklist && issue.checklist.total > 0 && <small aria-label="Checklist progress">{issue.checklist.completed}/{issue.checklist.total}</small>}
                      {issue.blocked && (
                        <small className="issue-blocked">Blocked</small>
                      )}
                      {issue.parent && (
                        <small>Parent: {issue.parent.identifier}</small>
                      )}
                      <span className="issue-labels">
                        {issue.labels.map((l) => (
                          <small key={l.id}>{l.name}</small>
                        ))}
                      </span>
                    </span>
                    <span className="issues-status">
                      <span className="issues-mobile-label">Status: </span>
                      {issue.status.name}
                    </span>
                    <span>
                      <span className="issues-mobile-label">Priority: </span>
                      {issue.priority === "none"
                        ? "No priority"
                        : issue.priority[0].toUpperCase() +
                          issue.priority.slice(1)}
                    </span>
                    <span>
                      <span className="issues-mobile-label">Team: </span>
                      {issue.team.name}
                    </span>
                    <span>
                      <span className="issues-mobile-label">Assignee: </span>
                      {issue.assignee?.name ?? "Unassigned"}
                      {issue.startDate && <small className="issues-due">Starts {date(issue.startDate)}</small>}
                      {issue.dueDate && (
                        <small className="issues-due">
                          Due {date(issue.dueDate)}
                        </small>
                      )}
                    </span>
                  </button>
                  <ManualOrderControls issue={issue} />
                  {rowAction ? <span className="issues-row-action">{rowAction(issue)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
