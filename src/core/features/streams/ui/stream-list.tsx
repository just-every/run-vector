import { useRef } from "react";
import type { StreamItem } from "./data";
import { moveRowFocus, reasonLabel, relativeTime, shortDate } from "./helpers";

type StreamListProps = {
  groups: Array<{ id: string; title: string; items: StreamItem[] }>;
  onOpen: (identifier: string) => void;
  selectedIdentifier?: string;
  hideAssignee?: boolean;
};

export function StreamList({
  groups,
  onOpen,
  selectedIdentifier,
  hideAssignee = false,
}: StreamListProps) {
  const rows = groups.flatMap((group) => group.items);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const focus = (index: number) => refs.current[index]?.focus();
  let offset = 0;
  return (
    <div className="stream-list" aria-label="Issue stream">
      {groups.map((group) => {
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
              <span>{group.items.length}</span>
            </div>
            {group.items.length === 0 ? (
              <p className="stream-empty">Nothing in this section.</p>
            ) : (
              <div className="stream-rows">
                {group.items.map((item, index) => {
                  const absoluteIndex = groupOffset + index;
                  return (
                    <button
                      className={`stream-row${selectedIdentifier === item.identifier ? " is-selected" : ""}`}
                      id={`issue-row-${item.identifier}`}
                      key={item.id}
                      ref={(element) => {
                        refs.current[absoluteIndex] = element;
                      }}
                      type="button"
                      onClick={() => onOpen(item.identifier)}
                      onKeyDown={(event) => {
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
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
