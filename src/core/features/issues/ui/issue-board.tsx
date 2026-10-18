import { ManualOrderControls } from '../../manual-order/ui/controls';
import { useHydrated } from "../../../app/initial-resources";
import { useLayoutEffect, useRef, useState } from "react";
import { ApiError, fetchJson } from "../../../app/api-client";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { issueDetailSchema, type IssueDetailData } from "./data";
import type { IssueRow } from "./issue-selection";
import type { IssueListData } from "../list-schema";

const ordinaryCategories = new Set([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
]);

export function IssueBoard({
  rows,
  statusCounts,
  team,
  options,
  onChangeTeam,
  onOpen,
  onRefresh,
  move,
  onMoved,
  onFocused,
  revision,
  refreshing,
  column,
  setColumn,
  notices,
  onBoardNotice,
}: {
  move: {
    identifier: string;
    status: string;
    statusName: string;
    version: number;
    revision: string;
    rejected: boolean;
  } | null;
  revision: string;
  refreshing: boolean;
  column: string;
  setColumn: (column: string) => void;
  notices: Map<string, string>;
  onBoardNotice: (identifier: string, message: string | null) => void;
  onMoved: (updated: IssueDetailData, rejected?: boolean) => void;
  onFocused: () => void;
  rows: IssueRow[];
  statusCounts: NonNullable<IssueListData["statusCounts"]>;
  team: string;
  options: WorkspaceOptions | null;
  onChangeTeam: (team: string) => void;
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  const hydrated = useHydrated();
  const statuses =
    options?.statuses
      .filter((s) => s.teamId === team)
      .sort((a, b) => a.position - b.position) || [];
  const region = useRef<HTMLDivElement>(null);
  const noticesRegion = useRef<HTMLDivElement>(null);
  const [focusNotice, setFocusNotice] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!move || refreshing) return;
    const row = rows.find((row) => row.identifier === move.identifier);
    if (revision === move.revision && (!row || row.version < move.version)) return;
    if (row && row.version < move.version) return;
    setColumn(row?.status.id ?? move.status);
    if (row) {
      const control = region.current?.querySelector(
        `[data-status-identifier="${move.identifier}"], [data-decision-identifier="${move.identifier}"]`,
      ) as unknown as HTMLSelectElement | HTMLButtonElement | null;
      if (!control || control.disabled) return;
      control.focus();
    } else {
      report(
        move.identifier,
        `${move.rejected ? "The requested move was not applied. Current server status is" : "Moved to"} ${move.statusName}. This issue is outside the current page or filters. Open issue to continue.`,
      );
      setFocusNotice(move.identifier);
    }
    onFocused();
  }, [rows, move, revision, refreshing]);
  useLayoutEffect(() => {
    if (!focusNotice) return;
    const button = noticesRegion.current?.querySelector(
      `[data-moved-issue="${focusNotice}"]`,
    ) as unknown as HTMLButtonElement | null;
    if (button) {
      button.focus();
      setFocusNotice(null);
    }
  }, [focusNotice]);
  function report(identifier: string, message: string | null) {
    onBoardNotice(identifier, message);
  }
  const reconciled = move &&
    rows.find(
      (row) => row.identifier === move.identifier && row.version >= move.version,
    );
  const selectedColumn = reconciled?.status.id ?? move?.status ?? column;
  const active = statuses.some((s) => s.id === selectedColumn)
    ? selectedColumn
    : statuses[0]?.id;
  const count = (statusId: string) =>
    statusCounts.find((status) => status.key === statusId)?.count ?? 0;
  const columnRows = (statusId: string) =>
    rows.filter((row) => row.status.id === statusId);
  return (
    <section className="issues-board" aria-label="Issue board">
      <div ref={noticesRegion}>
        {[...notices].map(([identifier, message]) => (
          <div className="issues-notice" role="alert" key={identifier}>
            <strong>{identifier}</strong>: {message}{" "}
            <button
              data-moved-issue={identifier}
              onClick={() => onOpen(identifier)}
            >
              Open issue
            </button>
            <button onClick={() => report(identifier, null)}>Dismiss</button>
          </div>
        ))}
      </div>
      <label className="board-team">
        Board team
        <select
          aria-label="Board team"
          disabled={!hydrated}
          value={team}
          onChange={(e) => onChangeTeam(e.target.value)}
        >
          <option value="all">Choose a team</option>
          {team !== "all" && !options?.teams.some((t) => t.id === team) && (
            <option value={team}>Selected team unavailable</option>
          )}
          {options?.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {team === "all" ? (
        <p>Choose one team to see its workflow board.</p>
      ) : (
        <>
          <label className="board-column-picker">
            Board column
            <select
              aria-label="Board column"
              disabled={!hydrated}
              value={active ?? ""}
              onChange={(e) => setColumn(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({count(s.id)})
                </option>
              ))}
            </select>
          </label>
          <div
            className="board-columns"
            ref={region}
            tabIndex={0}
            role="region"
            aria-label="Workflow columns"
          >
            {statuses.map((status) => (
              <section
                key={status.id}
                className={`board-column${status.id === active ? " is-current" : ""}`}
                aria-label={`${status.name} column`}
              >
                <h2>
                  {status.name} <span>{count(status.id)}</span>
                </h2>
                <p>
                  Showing {columnRows(status.id).length} of {count(status.id)}
                </p>
                {columnRows(status.id).map((row) => (
                  <BoardCard
                    key={row.id}
                    row={row}
                    statuses={statuses}
                    onOpen={onOpen}
                    onRefresh={onRefresh}
                    onNotice={report}
                    onMoved={onMoved}
                  />
                ))}
                {!rows.some((r) => r.status.id === status.id) && (
                  <p>No issues on this page.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function BoardCard({
  row,
  statuses,
  onOpen,
  onRefresh,
  onNotice,
  onMoved,
}: {
  onMoved: (updated: IssueDetailData, rejected?: boolean) => void;
  row: IssueRow;
  statuses: WorkspaceOptions["statuses"];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onNotice: (identifier: string, message: string | null) => void;
}) {
  const hydrated = useHydrated();
  const [receipt, setReceipt] = useState<IssueDetailData | null>(null),
    [busy, setBusy] = useState(false);
  const current = receipt && receipt.version > row.version ? receipt : row;
  async function change(statusId: string) {
    setBusy(true);
    onNotice(row.identifier, null);
    try {
      const updated = await fetchJson(
        `/api/issues/${row.identifier}`,
        issueDetailSchema,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion: current.version, statusId }),
        },
      );
      setReceipt(updated);
      onMoved(updated);
    } catch (error) {
      const body =
        error instanceof ApiError &&
        typeof error.body === "object" &&
        error.body !== null
          ? (error.body as { error?: unknown; issue?: unknown })
          : null;
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        body?.error === "stale_version"
      ) {
        const parsed = issueDetailSchema.safeParse(body.issue);
        onNotice(
          row.identifier,
          `This issue changed elsewhere. The requested move was not applied.${parsed.success ? ` Current server status is ${parsed.data.status.name}.` : ""} The board is refreshed from the server. Open this issue to review it, or choose a status again to retry.`,
        );
        if (parsed.success) {
          setReceipt(parsed.data);
          onMoved(parsed.data, true);
        } else onRefresh();
      } else
        onNotice(
          row.identifier,
          error instanceof Error
            ? error.message
            : "Status could not be changed.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="board-card">
      <button
        disabled={!hydrated}
        className="board-card-open"
        id={`issue-row-${row.identifier}`}
        onClick={() => onOpen(row.identifier)}
      >
        <small>{row.identifier}</small>
        <strong>{current.title}</strong>
        {row.checklist && row.checklist.total > 0 && <small aria-label="Checklist progress">{row.checklist.completed}/{row.checklist.total}</small>}
      </button>
      <p>
        {current.priority === "none" ? "No priority" : current.priority} ·{" "}
        {current.assignee?.name ?? "Unassigned"}
      </p>
      {row.blocked && <span className="issue-blocked">Blocked</span>}
      <div className="issue-labels">
        {row.labels.map((label) => (
          <span key={label.id}>{label.name}</span>
        ))}
      </div>
      <ManualOrderControls issue={row} />
      {ordinaryCategories.has(current.status.category) ? (
        <label>
          Status for {row.identifier}
          <select
            data-status-identifier={row.identifier}
            aria-label={`Status for ${row.identifier}`}
            disabled={!hydrated || busy}
            value={current.status.id}
            onChange={(e) => void change(e.target.value)}
          >
            {statuses.filter((s) => ordinaryCategories.has(s.category)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <p>{current.status.name} requires a decision.</p>
          <button
            disabled={!hydrated}
            data-decision-identifier={row.identifier}
            aria-label={`Review decision for ${row.identifier}`}
            onClick={() => onOpen(row.identifier)}
          >
            Review {current.status.category === "intake" ? "intake" : "duplicate"} decision
          </button>
        </>
      )}
    </article>
  );
}
