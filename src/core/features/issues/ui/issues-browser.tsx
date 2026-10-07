import { useNavigate, useSearch } from "@tanstack/react-router";
import { ApiError, useApiResource } from "../../../app/api-client";
import {
  issueListSchema,
  type IssueListData,
  type IssueListQuery,
} from "../list-schema";
import {
  changeIssueListFilters,
  defaultIssueListQuery,
  issueListApiUrl,
} from "./issue-list-controls";
import "./issues-browser.css";

export function IssuesBrowser() {
  const query = useSearch({ from: "/app/issues" });
  const navigate = useNavigate();
  const resource = useApiResource(
    issueListApiUrl(query),
    issueListSchema,
    5000,
  );
  return (
    <IssueListView
      query={query}
      {...resource}
      onChange={(changes) =>
        void navigate({
          to: "/app/issues",
          search: changeIssueListFilters(query, changes),
        })
      }
      onOpen={(identifier) =>
        void navigate({
          to: "/app/issues/$identifier",
          params: { identifier },
          search: query,
        })
      }
    />
  );
}

type Props = {
  query: IssueListQuery;
  data: IssueListData | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
  onChange: (changes: Partial<IssueListQuery>) => void;
  onOpen: (identifier: string) => void;
};
const categories = [
  "all",
  "intake",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "duplicate",
] as const;
export function IssueListView({
  query,
  data,
  loading,
  error,
  reload,
  onChange,
  onOpen,
}: Props) {
  const denied =
    error instanceof ApiError && [401, 403, 404, 410].includes(error.status);
  // A denied receipt must never leave cached private rows or operator choices visible.
  const visible = denied ? null : data;
  const filtered = Boolean(query.q || query.assignee !== "all");
  return (
    <main className="issues-browser">
      <header className="issues-heading">
        <div>
          <h1>Issues</h1>
          <p>Browse issues beyond Current.</p>
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
      </nav>
      <div className="issues-filters">
        <label>
          Title or identifier
          <input
            type="search"
            maxLength={200}
            value={query.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search issues"
          />
        </label>
        <label>
          Status category
          <select
            value={query.category}
            onChange={(e) =>
              onChange({
                category: e.target.value as IssueListQuery["category"],
              })
            }
          >
            {categories.map((value) => (
              <option key={value} value={value}>
                {value === "all"
                  ? "All except completed"
                  : value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <select
            value={query.assignee}
            onChange={(e) => onChange({ assignee: e.target.value })}
          >
            <option value="all">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {visible?.assignees.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
            {query.assignee !== "all" &&
              query.assignee !== "unassigned" &&
              !visible?.assignees.some(
                (actor) => actor.id === query.assignee,
              ) && (
                <option value={query.assignee}>
                  Selected operator unavailable
                </option>
              )}
          </select>
        </label>
      </div>
      <p className="issues-hint">
        Newest updates first.
        {query.category === "all"
          ? " Completed issues are hidden; choose Completed to browse them."
          : ""}
      </p>
      {error && (
        <div role="alert" className="issues-notice">
          {denied ? (
            <>
              This issue list is unavailable.{" "}
              <a href="/signin">Sign in again</a>.
            </>
          ) : (
            <>
              Could not refresh issues.
              {visible ? " Last loaded issues are shown." : ""}{" "}
              <button onClick={reload}>Retry</button>
            </>
          )}
        </div>
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
          {visible.issues.length ? (
            <div className="issues-table">
              <div className="issues-columns" aria-hidden="true">
                <span>Issue</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Team</span>
                <span>Assignee</span>
              </div>
              <ul>
                {visible.issues.map((issue) => (
                  <li key={issue.id}>
                    <button
                      className="issues-row"
                      id={`issue-row-${issue.identifier}`}
                      onClick={() => onOpen(issue.identifier)}
                    >
                      <span className="issues-title">
                        <span className="issues-identifier">
                          {issue.identifier}
                        </span>
                        <strong>{issue.title}</strong>
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
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <section className="issues-empty">
              <h2>
                {visible.total > 0
                  ? "No issues on this page"
                  : filtered
                    ? "No matching issues"
                    : query.category === "backlog"
                      ? "Backlog is empty"
                      : "No issues in this category"}
              </h2>
              <p>
                {filtered
                  ? "Try another title, identifier or assignee."
                  : "New issues can be created from here."}
              </p>
              {(filtered || query.offset > 0) && (
                <button
                  onClick={() =>
                    onChange({
                      ...defaultIssueListQuery,
                      category: query.category,
                    })
                  }
                >
                  Reset filters and page
                </button>
              )}{" "}
              <a href="/app/new">New issue</a>
            </section>
          )}
          <nav className="issues-pagination" aria-label="Issue pages">
            <button
              disabled={query.offset === 0}
              onClick={() =>
                onChange({
                  offset: Math.max(0, query.offset - visible.pageSize),
                })
              }
            >
              Previous
            </button>
            <span>
              {visible.issues.length
                ? `${query.offset + 1}–${query.offset + visible.issues.length} of ${visible.total}`
                : `0 shown of ${visible.total}`}
            </span>
            <button
              disabled={query.offset + visible.pageSize >= visible.total}
              onClick={() =>
                onChange({ offset: query.offset + visible.pageSize })
              }
            >
              Next
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
