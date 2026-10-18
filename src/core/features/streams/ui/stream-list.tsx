import { useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useHydrated } from "../../../app/initial-resources";
import type { IssueEditTarget } from "../../issues/ui/issue-keyboard-actions";
import { toggleIssueSelection } from "../../issues/ui/issue-selection";
import type { StreamItem } from "./data";
import { moveRowFocus, reasonLabel, relativeTime, shortDate } from "./helpers";

type StreamListProps = {
  groups: Array<{ id: string; title: string; items: StreamItem[] }>;
  onOpen: (identifier: string) => void;
  selectedIdentifier?: string;
  hideAssignee?: boolean;
  selection: Map<string, IssueEditTarget>;
  setSelection: Dispatch<SetStateAction<Map<string, IssueEditTarget>>>;
  focused: string;
  setFocused: (identifier: string) => void;
  ownedFocus: { current: string | null };
};

export function StreamList({
  groups,
  onOpen,
  selectedIdentifier,
  hideAssignee = false,
  selection, setSelection, focused, setFocused, ownedFocus,
}: StreamListProps) {
  const hydrated = useHydrated();
  const [decisionLimit, setDecisionLimit] = useState(50);
  const visibleGroups = groups.map(group => ({
    ...group, total: group.items.length,
    items: group.id === "needs-decision" ? group.items.slice(0, decisionLimit) : group.items,
  }));
  const rows = visibleGroups.flatMap((group) => group.items);
  const list = useRef<HTMLDivElement>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const focus = (index: number) => refs.current[index]?.focus();
  useLayoutEffect(() => {
    const next = rows.some(row => row.identifier === focused) ? focused : rows[0]?.identifier ?? "";
    if (next !== focused) setFocused(next);
    if (ownedFocus.current && list.current?.getClientRects().length) {
      const retained = rows.findIndex(row => row.identifier === ownedFocus.current);
      focus(retained < 0 ? 0 : retained);
      if (!rows.length) ownedFocus.current = null;
    }
  }, [groups, focused, setFocused, ownedFocus]);
  let offset = 0;
  return (
    <div ref={list} className="stream-list" aria-label="Issue stream">
      {visibleGroups.map((group) => {
        const groupOffset = offset;
        offset += group.items.length;
        return (
          <section
            className="stream-group"
            key={group.id}
            aria-labelledby={`section-${group.id}`}
          >
            <div className="stream-group-heading">
              <h2 id={`section-${group.id}`}>{group.title}</h2>
              <span>{group.total}</span>
            </div>
            {group.items.length === 0 ? (
              <p className="stream-empty">Nothing in this section.</p>
            ) : (
              <div className="stream-rows">
                {group.items.map((item, index) => {
                  const absoluteIndex = groupOffset + index;
                  return (
                    <div className="stream-selectable" key={item.id}>
                    <label className="stream-selection">
                      <input type="checkbox" disabled={!hydrated} aria-label={`Select ${item.identifier}`}
                        checked={selection.has(item.identifier)}
                        onChange={() => setSelection(current => toggleIssueSelection(current, item))} />
                    </label>
                    <button
                      disabled={!hydrated}
                      className={`stream-row${selectedIdentifier === item.identifier ? " is-selected" : ""}`}
                      id={`issue-row-${item.identifier}`}
                      data-issue-identifier={item.identifier}
                      tabIndex={item.identifier === (focused || rows[0]?.identifier) ? 0 : -1}
                      onFocus={() => setFocused(item.identifier)}
                      ref={(element) => {
                        refs.current[absoluteIndex] = element;
                      }}
                      type="button"
                      onClick={() => onOpen(item.identifier)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
                        if (event.key.toLowerCase() === "x") {
                          event.preventDefault();
                          setSelection(current => toggleIssueSelection(current, item));
                        }
                        if (
                          event.key === "ArrowDown" ||
                          event.key === "ArrowUp"
                        ) {
                          event.preventDefault();
                          focus(
                            moveRowFocus(
                              absoluteIndex,
                              event.key === "ArrowDown" ? "next" : "previous",
                              rows.length,
                            ),
                          );
                        }
                      }}
                      aria-label={`${item.identifier}: ${item.title}. ${reasonLabel(item.primaryReason)}.`}
                    >
                      <span className="stream-row-top">
                        <span className="issue-identifier">
                          {item.identifier}
                        </span>
                        <span className={`priority priority--${item.priority}`}>
                          {item.priority === "none"
                            ? "No priority"
                            : item.priority}
                        </span>
                      </span>
                      <strong>{item.title}</strong>
                      <span className="stream-row-meta">
                        <span>{item.status.name}</span>
                        {!hideAssignee ? (
                          <span>{item.assignee?.name ?? "Unassigned"}</span>
                        ) : null}
                        <span>
                          {item.dueDate
                            ? shortDate(item.dueDate)
                            : relativeTime(item.updatedAt)}
                        </span>
                      </span>
                      <span className="stream-reasons">
                        <span className="reason-pill reason-pill--primary">
                          {reasonLabel(item.primaryReason)}
                        </span>
                        {item.contextReasons.map((reason) => (
                          <span className="reason-pill" key={reason}>
                            {reasonLabel(reason)}
                          </span>
                        ))}
                      </span>
                    </button>
                    </div>
                  );
                })}
              </div>
            )}
            {group.id === "needs-decision" && group.total > 50 ? (
              <div className="stream-pagination">
                <p role="status">{group.items.length} shown of {group.total}</p>
                {group.items.length < group.total ? (
                  <button type="button" disabled={!hydrated} onClick={() => setDecisionLimit(limit => limit + 50)}>
                    Show more decisions
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
