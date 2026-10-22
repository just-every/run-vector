import { ManualOrderBoundary, ManualOrderNotice } from '../../manual-order/ui/context';
import { useEffect, useRef, useState } from "react";
import { ApiError, useApiResource } from "../../../app/api-client";
import { workspaceOptionsSchema } from "../../../shared/workspace-options";
import type { IssueListData, IssueListQuery } from "../list-schema";
import { defaultIssueListQuery, issueListSearch } from "./issue-list-controls";
import { IssueFilters } from "./issue-filters";
import { IssueBoard } from "./issue-board";
import { IssueTable } from "./issue-table";
import { IssueBulk } from "./issue-bulk";
import { IssueKeyboard } from "./issue-keyboard";
import { useIssueRowFocus } from "./issue-keyboard-focus";
import { refreshIssueSelection, type IssueRow } from "./issue-selection";
import { SaveView } from "../../views/ui/saved-views";

type Props = {
  query: IssueListQuery;
  data: IssueListData | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
  onChange: (changes: Partial<IssueListQuery>) => void;
  onOpen: (identifier: string) => void;
  layout?: "list" | "board";
  title?: string;
  viewActions?: React.ReactNode;
  onReset?: () => void;
  onSwitchLayout?: () => void;
  onCreateView?: (viewId: string) => void;
  description?: string;
  before?: React.ReactNode;
  rowAction?: (issue: IssueListData["issues"][number]) => React.ReactNode;
};
const scopeNotes = { created: "Only issues you created.", subscribed: "Only issues you follow." } as const;
export function IssueListView({
  query,
  data,
  loading,
  error,
  reload,
  onChange,
  onOpen,
  layout = "list",
  title,
  viewActions,
  onReset,
  onSwitchLayout,
  onCreateView,
  description,
  before,
  rowAction,
}: Props) {
  const denied =
    error instanceof ApiError && [401, 403, 404, 410].includes(error.status);
  const invalidated =
    error instanceof ApiError &&
    error.status === 409 &&
    (error.body as { error?: string } | null)?.error ===
      "pagination_invalidated";
  const [restarted, setRestarted] = useState(false);
  useEffect(() => {
    if (invalidated) {
      setRestarted(true);
      onChange({ offset: 0, revision: "" });
    }
  }, [invalidated, onChange]);
  const visible = denied || invalidated ? null : data;
  const optionResource = useApiResource("/api/options", workspaceOptionsSchema);
  const options = denied ? null : optionResource.data;
  const [selection, setSelection] = useState(new Map<string, IssueRow>());
  const [focused, setFocused] = useState("");
  const root = useRef<HTMLElement>(null);
  const ownedFocus = useIssueRowFocus(root);
  const [boardColumn, setBoardColumn] = useState("");
  const [boardNotices, setBoardNotices] = useState(new Map<string, string>());
  const [move, setMove] = useState<{
    identifier: string;
    status: string;
    version: number;
    revision: string;
    statusName: string;
    rejected: boolean;
  } | null>(null);
  useEffect(() => {
    if (denied) {
      setSelection(new Map());
      setBoardNotices(new Map());
      setMove(null);
    } else if (visible)
      setSelection((current) => refreshIssueSelection(current, visible.issues));
  }, [visible, denied]);
  function updatedSelection(issues: Array<{ identifier: string; version: number }>) {
    setSelection((current) => {
      const next = new Map(current);
      issues.forEach((receipt) => {
        const row = next.get(receipt.identifier);
        if (row) next.set(receipt.identifier, { ...row, version: receipt.version });
      });
      return next;
    });
  }
  return (
    <ManualOrderBoundary query={query} rows={visible?.issues ?? []} reload={reload}>
    <main
      ref={root}
      className="issues-browser"
      // The shown query and its load state, for assistive checks and tests.
      data-list-query={issueListSearch(query)}
      data-list-state={loading ? "loading" : "ready"}
    >
      {before}
      <header className="issues-heading">
        <div>
          <h1>{title ?? (layout === "board" ? "Board" : "Issues")}</h1>
          <p>
            {description ?? (layout === "board"
              ? "Work through one team’s workflow."
              : "Browse issues beyond Current.")}
          </p>
          {query.scope !== "all" && !description ? <p className="issues-scope">{scopeNotes[query.scope]}</p> : null}
        </div>
        <a href="/app/new">New issue</a>
      </header>
      <nav className="issues-modes" aria-label="Issue list">
        <button
          aria-pressed={query.category === "all"}
          onClick={() => onChange({ category: "all" })}
        >
          All issues
        </button>
        <button
          aria-pressed={query.category === "backlog"}
          onClick={() => onChange({ category: "backlog" })}
        >
          Backlog
        </button>
        {onSwitchLayout && (
          <button onClick={onSwitchLayout}>
            {layout === "board" ? "List" : "Board"}
          </button>
        )}
      </nav>
      {!denied && (
        <>
          {options ? (
            <IssueFilters
              fixedGrouping={layout === "board"}
              query={query}
              options={options}
              onChange={onChange}
              onReset={onReset ?? (() => onChange(defaultIssueListQuery))}
            />
          ) : (
            optionResource.loading && (
              <p role="status">Loading filter choices…</p>
            )
          )}
          {viewActions ??
            (onCreateView && (
              <SaveView
                canShare={!!options && options.operator.role !== "guest"}
                query={query}
                layout={layout}
                limit={options?.savedViewsPerOperator}
                onCreated={onCreateView}
              />
            ))}
        </>
      )}
      <ManualOrderNotice query={query} />
      {restarted && (
        <p role="status">
          Issues changed. Pagination restarted from the first page.
        </p>
      )}
      {error && !invalidated && (
        <div role="alert" className="issues-notice">
          {denied ? (
            <>
              This issue list is unavailable.{" "}
              <a href="/signin">Sign in again</a>.
            </>
          ) : (
            <>
              Could not refresh issues. {error.message}{" "}
              {visible ? "Last loaded issues are shown." : ""}{" "}
              <button onClick={reload}>Retry</button>
            </>
          )}
        </div>
      )}
      {optionResource.error && !denied && (
        <p role="alert">
          Could not load filter choices.{" "}
          <button onClick={optionResource.reload}>Retry choices</button>
        </p>
      )}
      {loading && (
        <p role="status">
          {visible ? "Refreshing issues…" : "Loading issues…"}
        </p>
      )}
      {visible && (
        <>
          <p className="issues-count">
            {visible.total} {visible.total === 1 ? "issue" : "issues"}
          </p>
          {layout === "list" && <IssueKeyboard root={root} rows={visible.issues} selection={selection}
            focused={focused} options={options} onRefresh={reload} onSuccess={updatedSelection} />}
          <IssueBulk
            selection={selection}
            options={options}
            onClear={() => setSelection(new Map())}
            onRefresh={reload}
            onRemove={(identifier) =>
              setSelection((current) => {
                const next = new Map(current);
                next.delete(identifier);
                return next;
              })
            }
            onSuccess={updatedSelection}
          />
          {layout === "board" ? (
            options ? (
              <IssueBoard
                column={boardColumn}
                setColumn={setBoardColumn}
                notices={boardNotices}
                onBoardNotice={(identifier, message) =>
                  setBoardNotices((current) => {
                    const next = new Map(current);
                    if (message) next.set(identifier, message);
                    else next.delete(identifier);
                    return next;
                  })
                }
                move={move}
                onFocused={() => setMove(null)}
                onMoved={(updated, rejected = false) => {
                  setMove({
                    identifier: updated.identifier,
                    status: updated.status.id,
                    statusName: updated.status.name,
                    version: updated.version,
                    revision: visible.revision,
                    rejected,
                  });
                  reload();
                }}
                revision={visible.revision}
                refreshing={loading}
                rows={visible.issues}
                statusCounts={visible.statusCounts!}
                team={query.team}
                options={options}
                onChangeTeam={(team) => onChange({ team })}
                onOpen={onOpen}
                onRefresh={reload}
              />
            ) : (
              optionResource.loading && (
                <p role="status">Loading board workflow…</p>
              )
            )
          ) : (
            <IssueTable
              data={visible}
              grouping={query.grouping}
              selection={selection}
              setSelection={setSelection}
              onOpen={onOpen}
              focused={focused}
              setFocused={setFocused}
              ownedFocus={ownedFocus}
              rowAction={rowAction}
            />
          )}
          {!visible.issues.length && (
            <section className="issues-empty">
              <h2>
                {visible.total
                  ? "No issues on this page"
                  : query.category === "backlog"
                    ? "Backlog is empty"
                    : "No matching issues"}
              </h2>
              <p>Try different controls, or create an issue.</p>
              <button
                onClick={onReset ?? (() => onChange(defaultIssueListQuery))}
              >
                Reset filters and page
              </button>{" "}
              <a href="/app/new">New issue</a>
            </section>
          )}
          <nav className="issues-pagination" aria-label="Issue pages">
            <button
              disabled={visible.offset === 0}
              onClick={() =>
                onChange({
                  offset: Math.max(0, visible.offset - visible.pageSize),
                  revision: visible.revision,
                })
              }
            >
              Previous
            </button>
            <span>
              {visible.issues.length
                ? `${visible.offset + 1}–${visible.offset + visible.issues.length} of ${visible.total}`
                : `0 shown of ${visible.total}`}
            </span>
            <button
              disabled={visible.offset + visible.pageSize >= visible.total}
              onClick={() =>
                onChange({
                  offset: visible.offset + visible.pageSize,
                  revision: visible.revision,
                })
              }
            >
              Next
            </button>
          </nav>
        </>
      )}
    </main>
    </ManualOrderBoundary>
  );
}
