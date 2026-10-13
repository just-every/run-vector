import { useEffect, useState } from "react";
import { useMatch, useNavigate, useParams } from "@tanstack/react-router";
import {
  useApiResource,
  isUnavailableResourceError,
} from "../../../app/api-client";
import { workspaceOptionsSchema } from "../../../shared/workspace-options";
import { IssueBrowserPane } from "../../issues/ui/issue-browser-pane";
import { IssueBrowserSurface } from "../../issues/ui/issues-browser";
import {
  changeIssueListFilters,
  defaultIssueListQuery,
} from "../../issues/ui/issue-list-controls";
import { useSavedViewResource } from "./saved-view-resource";
import { SavedViewActions } from "./saved-views";
import type { IssueListQuery } from "../../issues/list-schema";
export function SavedViewPage() {
  const { viewId } = useParams({ from: "/app/views/$viewId" });
  const navigate = useNavigate();
  const detail = useMatch({
    from: "/app/views/$viewId/$identifier",
    shouldThrow: false,
  });
  const opened = detail?.params.identifier ?? null;
  const resource = useSavedViewResource(viewId),
    options = useApiResource("/api/options", workspaceOptionsSchema);
  const [local, setLocal] = useState<{
    id: string;
    query: IssueListQuery;
    layout: "list" | "board";
  } | null>(null);
  const unavailable = isUnavailableResourceError(resource.error);
  const view = unavailable ? null : resource.data;
  // Metadata-only receipts preserve unsaved controls. A changed stored query
  // or layout, a new view identity, or a denial reconciles the local draft.
  const storedControls = view
    ? JSON.stringify({ query: view.query, layout: view.layout })
    : null;
  useEffect(() => {
    if (view) setLocal({ id: view.id, query: view.query, layout: view.layout });
    else if (unavailable) setLocal(null);
  }, [view?.id, storedControls, unavailable]);
  if (!view)
    return (
      <main className="issues-browser">
        <h1>Saved view</h1>
        {resource.error ? (
          <p role="alert">
            {isUnavailableResourceError(resource.error)
              ? "This view is unavailable."
              : resource.error.message}{" "}
            <button onClick={resource.reload}>Retry</button>
          </p>
        ) : (
          <p>Loading saved view…</p>
        )}
      </main>
    );
  const query = local?.id === view.id ? local.query : view.query,
    layout = local?.id === view.id ? local.layout : view.layout;
  return (
    <IssueBrowserPane
      identifier={opened}
      onClose={() => navigate({ to: "/app/views/$viewId", params: { viewId } })}
    >
      <IssueBrowserSurface
        query={query}
        layout={layout}
        title={view.name}
        onChange={(change) =>
          // Build on the latest local query so quick successive changes all apply.
          setLocal((previous) => {
            const current =
              previous?.id === view.id
                ? previous
                : { id: view.id, query: view.query, layout: view.layout };
            return {
              ...current,
              query: changeIssueListFilters(current.query, change),
            };
          })
        }
        onReset={() =>
          setLocal({ id: view.id, query: defaultIssueListQuery, layout })
        }
        onOpen={(identifier) =>
          void navigate({
            to: "/app/views/$viewId/$identifier",
            params: { viewId, identifier },
          })
        }
        viewActions={
          <>
            <label className="saved-view-layout">
              View layout
              <select
                aria-label="View layout"
                value={layout}
                onChange={(e) =>
                  setLocal({
                    id: view.id,
                    query,
                    layout: e.target.value as "list" | "board",
                  })
                }
              >
                <option value="list">List</option>
                <option value="board">Board</option>
              </select>
            </label>
            {options.data && (
              <SavedViewActions
                key={view.id}
                view={view}
                operatorId={options.data.operator.id}
                query={query}
                layout={layout}
              />
            )}
          </>
        }
      />
    </IssueBrowserPane>
  );
}
