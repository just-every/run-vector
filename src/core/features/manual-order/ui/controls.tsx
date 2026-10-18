import type { IssueListData } from "../../issues/list-schema";
import { useManualOrder } from "./context";
const transfer = "text/x-vector-issue-order";
export function ManualOrderControls({
  issue,
}: {
  issue: IssueListData["issues"][number];
}) {
  const order = useManualOrder();
  if (!order) return null;
  const rows = order.rows.filter((row) => row.groupKey === issue.groupKey),
    at = rows.findIndex((row) => row.id === issue.id);
  const disabled = order.pending || !order.ready;
  return (
    <div
      className="manual-order-controls"
      role="group"
      aria-label={"Order " + issue.identifier}
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(transfer, issue.identifier);
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes(transfer)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        const source = event.dataTransfer.getData(transfer);
        if (!source || disabled) return;
        event.preventDefault();
        order.before(source, issue.identifier);
      }}
    >
      <span
        className="manual-order-handle"
        title="Drag this handle before another issue"
      >
        ⠿ Reorder
      </span>
      <button
        type="button"
        disabled={disabled || at === 0}
        aria-label={"Move " + issue.identifier + " up"}
        onClick={() => order.move(issue, "up")}
      >
        ↑
      </button>
      <button
        type="button"
        disabled={disabled || at === rows.length - 1}
        aria-label={"Move " + issue.identifier + " down"}
        onClick={() => order.move(issue, "down")}
      >
        ↓
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={"Move " + issue.identifier + " to top"}
        onClick={() => order.move(issue, "top")}
      >
        Top
      </button>
    </div>
  );
}
