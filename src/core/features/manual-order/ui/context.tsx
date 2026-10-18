import { createContext, useContext, useState, type ReactNode } from "react";
import { ApiError, fetchJson, useApiResource } from "../../../app/api-client";
import type { IssueListData, IssueListQuery } from "../../issues/list-schema";
import { manualOrderStateSchema } from "../schema";
import "./manual-order.css";
type Row = IssueListData["issues"][number];
type Direction = "up" | "down" | "top";
type Ordering = {
  rows: Row[];
  pending: boolean;
  ready: boolean;
  message: string;
  error: string;
  move: (issue: Row, direction: Direction) => void;
  before: (identifier: string, anchor: string) => void;
};
const Context = createContext<Ordering | null>(null);
export const useManualOrder = () => useContext(Context);
export function ManualOrderBoundary({
  query,
  rows,
  reload,
  children,
}: {
  query: IssueListQuery;
  rows: Row[];
  reload: () => void;
  children: ReactNode;
}) {
  if (query.sort !== "manual" || (!query.orderView && query.team === "all"))
    return <>{children}</>;
  const scope = query.orderView
    ? {
        viewId: query.orderView,
        ...(query.team === "all" ? {} : { teamId: query.team }),
      }
    : { teamId: query.team };
  return (
    <ActiveOrder
      key={JSON.stringify(scope)}
      scope={scope}
      rows={rows}
      reload={reload}
    >
      {children}
    </ActiveOrder>
  );
}
function ActiveOrder({
  scope,
  rows,
  reload,
  children,
}: {
  scope: { teamId?: string; viewId?: string };
  rows: Row[];
  reload: () => void;
  children: ReactNode;
}) {
  const state = useApiResource(
    "/api/issues/order?" + new URLSearchParams(scope).toString(),
    manualOrderStateSchema,
    5000,
  );
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function command(identifier: string, action: string, anchor?: string) {
    if (pending || !state.data) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchJson(
        "/api/issues/order",
        manualOrderStateSchema,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...scope,
            identifier,
            action,
            anchor,
            expectedVersion: state.data.version,
          }),
        },
      );
      state.publishReceipt(() => result);
      reload();
      setMessage("Manual order saved for " + identifier + ".");
      window.dispatchEvent(new Event("vector:issues-changed"));
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 409
          ? "The order changed elsewhere. Your move was not applied. The current order has been loaded; try again."
          : cause instanceof Error
            ? cause.message
            : "Order could not be saved.",
      );
      state.reload();
      reload();
    } finally {
      setPending(false);
    }
  }
  function move(issue: Row, direction: Direction) {
    if (direction === "top") {
      void command(issue.identifier, "top");
      return;
    }
    const group = rows.filter((row) => row.groupKey === issue.groupKey),
      at = group.findIndex((row) => row.id === issue.id);
    const anchor = group[at + (direction === "up" ? -1 : 1)];
    if (anchor)
      void command(
        issue.identifier,
        direction === "up" ? "before" : "after",
        anchor.identifier,
      );
  }
  return (
    <Context.Provider
      value={{
        rows,
        pending,
        ready: !!state.data,
        message,
        error: error || state.error?.message || "",
        move,
        before: (identifier, anchor) => {
          if (identifier === anchor) return;
          const source = rows.find((row) => row.identifier === identifier),
            target = rows.find((row) => row.identifier === anchor);
          if (!source || !target || source.groupKey !== target.groupKey) {
            setError(
              "Reorder within the same group. Use the issue properties to change its group.",
            );
            return;
          }
          void command(identifier, "before", anchor);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function ManualOrderNotice({ query }: { query: IssueListQuery }) {
  const order = useManualOrder();
  if (query.sort !== "manual") return null;
  return (
    <div className="manual-order-notice">
      <p>
        {!order
          ? "Choose a team to reorder its issues, or open a saved view."
          : "Manual order is shared for this team or saved view. Drag a Reorder handle, use the move buttons, or press Alt + ↑ / ↓ on a focused issue. Groups keep their own order."}
      </p>
      {order?.pending && <p role="status">Saving manual order…</p>}
      {order?.message && <p role="status">{order.message}</p>}
      {order?.error && <p role="alert">{order.error}</p>}
    </div>
  );
}
