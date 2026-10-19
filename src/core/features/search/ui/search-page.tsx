import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { fetchJson, isUnavailableResourceError } from "../../../app/api-client";
import { searchErrorMessage } from "./search-error";
import { workspaceSearchSchema } from "./data";
import "../../issues/ui/issues-browser.css";
export function SearchPage() {
  const [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [data, setData] = useState<ReturnType<
      typeof workspaceSearchSchema.parse
    > | null>(null),
    [resultTerm, setResultTerm] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const term = query.trim();
    setData(null);
    setError("");
    if (!term) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetchJson(
      `/api/search?q=${encodeURIComponent(term)}&includeArchived=${archived ? "true" : "false"}`,
      workspaceSearchSchema,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setResultTerm(JSON.stringify([term, archived]));
          setData(result);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            isUnavailableResourceError(cause)
              ? "Search is unavailable."
              : searchErrorMessage(cause),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, archived, attempt]);
  const visibleData =
    resultTerm === JSON.stringify([query.trim(), archived]) ? data : null;
  const count = visibleData
    ? visibleData.issues.length +
      visibleData.projects.length +
      visibleData.savedViews.length
    : 0;
  return (
    <main className="issues-browser workspace-search">
      <header className="issues-heading">
        <div>
          <h1>Search</h1>
          <p>Find issues, projects and saved views across your workspace.</p>
        </div>
      </header>
      <div className="issues-filters">
        <label>
          Search workspace
          <input
            type="search"
            disabled={!ready}
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Identifier, title, description, comment…"
          />
        </label>
        <label className="saved-view-check">
          <input
            type="checkbox"
            disabled={!ready}
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Include archived issues, teams and projects
        </label>
      </div>
      {error && (
        <p className="issues-notice" role="alert">
          {error}{" "}
          <button onClick={() => setAttempt((current) => current + 1)}>
            Retry
          </button>
        </p>
      )}
      {loading && <p role="status">Searching…</p>}
      {!query.trim() && <p>Enter a search term to find workspace records.</p>}
      {visibleData && (
        <>
          {!count ? (
            <section className="issues-empty">
              <h2>No results</h2>
              <p>
                Try another identifier or search term
                {archived ? "" : ", or include archived records"}.
              </p>
            </section>
          ) : (
            <>
              <p>
                {count} {count === 1 ? "result" : "results"}
              </p>
              {visibleData.issues.length > 0 && (
                <section>
                  <h2>Issues</h2>
                  <ul className="search-results">
                    {visibleData.issues.map((issue) => (
                      <li key={issue.id}>
                        <Link
                          to="/app/issues/$identifier"
                          params={{ identifier: issue.identifier }}
                        >
                          <small>{issue.identifier}</small>
                          <strong>{issue.title}</strong>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {visibleData.projects.length > 0 && (
                <section>
                  <h2>Projects</h2>
                  <ul className="search-results">
                    {visibleData.projects.map((project) => (
                      <li key={project.id}>
                        <Link
                          to="/app/projects/$projectId"
                          params={{ projectId: project.id }}
                        >
                          {project.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {visibleData.savedViews.length > 0 && (
                <section>
                  <h2>Saved views</h2>
                  <ul className="search-results">
                    {visibleData.savedViews.map((view) => (
                      <li key={view.id}>
                        <Link
                          to="/app/views/$viewId"
                          params={{ viewId: view.id }}
                        >
                          {view.name}
                          <small>{view.isShared ? "Shared" : "Private"}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
