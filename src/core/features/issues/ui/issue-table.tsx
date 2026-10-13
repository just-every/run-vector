import type { Dispatch, SetStateAction } from "react";
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
}: {
  data: IssueListData;
  grouping: string;
  selection: Map<string, IssueRow>;
  setSelection: Dispatch<SetStateAction<Map<string, IssueRow>>>;
  onOpen: (id: string) => void;
  focused: string;
  setFocused: (id: string) => void;
}) {
  function keyDown(event: React.KeyboardEvent, row: IssueRow) {
    if (!data || event.target !== event.currentTarget) return;
    if (event.key === "x" || event.key === "X") {
      event.preventDefault();
      setSelection((current) => toggleIssueSelection(current, row));
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = data.issues.findIndex(
          (r) => r.identifier === row.identifier,
        ),
        next =
          data.issues[
            Math.max(
              0,
              Math.min(
                data.issues.length - 1,
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
    <>
      {data.issues.length > 0 && (
        <label className="issues-select-page">
          <input
            type="checkbox"
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
      {issueGroups(data, grouping).map((group) => (
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
                    className={`issues-row${focused === issue.identifier ? " is-focused" : ""}`}
                    id={`issue-row-${issue.identifier}`}
                    onFocus={() => setFocused(issue.identifier)}
                    onKeyDown={(event) => keyDown(event, issue)}
                    onClick={() => onOpen(issue.identifier)}
                  >
                    <span className="issues-title">
                      <span className="issues-identifier">
                        {issue.identifier}
                      </span>
                      <strong>{issue.title}</strong>
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
                      {issue.dueDate && (
                        <small className="issues-due">
                          Due {issue.dueDate}
                        </small>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </>
  );
}
