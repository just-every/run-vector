import { useEffect, useRef, type ReactNode } from "react";
import { useListPreferences } from "../../views/ui/use-list-preferences";
import type { IssueListQuery } from "../list-schema";
import {
  changeIssueListFilters,
  defaultIssueListQuery,
  issueListSearch,
  issueListLayoutQuery,
} from "./issue-list-controls";

export function issuePreferenceValues(query: IssueListQuery) {
  const {
    offset: _offset,
    revision: _revision,

    sort,
    grouping,
    ...filters
  } = query;
  return { filters, sort, grouping };
}
const defaults = issuePreferenceValues(defaultIssueListQuery);
export function StoredIssueControls({
  surface,
  query,
  onChange,
  children,
}: {
  surface: "issues" | "board";
  query: IssueListQuery;
  onChange: (changes: Partial<IssueListQuery>) => void;
  children: (
    change: (changes: Partial<IssueListQuery>) => void,
    reset: () => void,
  ) => ReactNode;
}) {
  const preference = useListPreferences(surface, defaults),
    initialized = useRef(false),
    initialQuery = useRef(query),
    // Several controls can change before the URL re-renders; build on the
    // latest requested query so no change is lost.
    latest = useRef({ seen: query, next: query });
  if (latest.current.seen !== query)
    latest.current = { seen: query, next: query };
  useEffect(() => {
    if (!preference.ready || initialized.current) return;
    initialized.current = true;
    if (issueListSearch(initialQuery.current)) {
      const initial = issueListLayoutQuery(initialQuery.current, surface === "board" ? "board" : "list");
      preference.update(issuePreferenceValues(initial));
      if (issueListSearch(initial) !== issueListSearch(initialQuery.current)) onChange(initial);
    } else {
      const restored = issueListLayoutQuery(changeIssueListFilters(initialQuery.current, {
        ...preference.filters,
        sort: preference.sort,
        grouping: preference.grouping,
        offset: 0,
      }), surface === "board" ? "board" : "list");
      if (issueListSearch(restored) !== issueListSearch(initialQuery.current)) onChange(restored);
    }
  }, [preference.ready, onChange]);
  function change(changes: Partial<IssueListQuery>) {
    const next = changeIssueListFilters(latest.current.next, changes);
    latest.current = { ...latest.current, next };
    if (
      Object.keys(changes).some((key) => key !== "offset" && key !== "revision")
    )
      preference.update(issuePreferenceValues(next));
    onChange(next);
  }
  if (!preference.ready)
    return (
      <main className="issues-browser">
        <h1>{surface === "board" ? "Board" : "Issues"}</h1>
        {preference.loadError ? (
          <p role="alert">
            Could not restore controls. {preference.loadError.message}{" "}
            <button onClick={preference.retryLoad}>Retry</button>
          </p>
        ) : (
          <p role="status">Restoring controls…</p>
        )}
      </main>
    );
  return (
    <>
      {preference.saveError && (
        <p className="issues-notice" role="alert">
          Controls could not be saved. {preference.saveError.message}{" "}
          <button onClick={preference.retrySave}>Retry save</button>
        </p>
      )}
      {children(change, () => {
        latest.current = { ...latest.current, next: defaultIssueListQuery };
        preference.reset();
        onChange(defaultIssueListQuery);
      })}
    </>
  );
}
