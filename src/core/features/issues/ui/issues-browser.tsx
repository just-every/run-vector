import { preferredTeam } from "./preferred-team";
import { administrationSchema } from "../../administration/schema";
import {SubscriptionFilters} from '../../subscriptions/ui/subscriptions';
import {
  useMatch,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { IssueBrowserPane } from "./issue-browser-pane";
import { useApiResource } from "../../../app/api-client";
import { issueListSchema, type IssueListData, type IssueListQuery } from "../list-schema";
import {
  changeIssueListFilters,
  issueListApiUrl,
  issueListLayoutQuery,
} from "./issue-list-controls";
import { IssueListView } from "./issue-list-view";
export { IssueListView } from "./issue-list-view";
import { StoredIssueControls } from "./issue-list-preferences";
import { workspaceOptionsSchema } from "../../../shared/workspace-options";
import "./issues-browser.css";

export function IssuesBrowser() {
  const query = useSearch({ from: "/app/issues" }),
    navigate = useNavigate();
  const opened = useMatch({
    from: "/app/issues/$identifier",
    shouldThrow: false,
  })?.params.identifier;
  const change = (changes: Partial<IssueListQuery>) => {
    const search = changeIssueListFilters(query, changes);
    // Restoring the mounted background list must keep a deep-linked issue open.
    void (opened
      ? navigate({
          to: "/app/issues/$identifier",
          params: { identifier: opened },
          search,
        })
      : navigate({ to: "/app/issues", search }));
  };
  return (
    <StoredIssueControls surface="issues" query={query} onChange={change}>
      {(onChange, onReset) => (
        <IssueBrowserSurface
          query={query}
          layout="list"
          onChange={onChange}
          onReset={onReset}
          onOpen={(identifier) =>
            void navigate({
              to: "/app/issues/$identifier",
              params: { identifier },
              search: query,
            })
          }
        />
      )}
    </StoredIssueControls>
  );
}
export function BoardBrowser() {
  const detail = useMatch({
    from: "/app/board/$identifier",
    shouldThrow: false,
  });
  const opened = detail?.params.identifier ?? null;
  const storedQuery = useSearch({ from: "/app/board" }),
    navigate = useNavigate();
  const query = issueListLayoutQuery(storedQuery, "board");
  const change = (changes: Partial<IssueListQuery>) =>
    void navigate({
      to: "/app/board",
      search: changeIssueListFilters(query, {
        ...changes,
        pageSize: 100,
        grouping: "status",
      }),
    });
  return (
    <IssueBrowserPane
      identifier={opened}
      onClose={() => navigate({ to: "/app/board", search: query })}
    >
      <StoredIssueControls
        surface="board"
        query={storedQuery}
        onChange={change}
      >
        {(onChange, onReset) => (
          <IssueBrowserSurface
            query={query}
            layout="board"
            onChange={onChange}
            onReset={onReset}
            onOpen={(identifier) =>
              void navigate({
                to: "/app/board/$identifier",
                params: { identifier },
                search: query,
              })
            }
          />
        )}
      </StoredIssueControls>
    </IssueBrowserPane>
  );
}
export function IssueBrowserSurface({
  query,
  layout,
  onChange,
  onOpen,
  title,
  viewActions,
  onReset,
  description,
  before,
  rowAction,
  switchLayout = true,
}: {
  query: IssueListQuery;
  layout: "list" | "board";
  onChange: (changes: Partial<IssueListQuery>) => void;
  onOpen: (identifier: string) => void;
  title?: string;
  viewActions?: React.ReactNode;
  onReset?: () => void;
  description?: string;
  before?: React.ReactNode;
  rowAction?: (issue: IssueListData["issues"][number], refresh: () => void) => React.ReactNode;
  switchLayout?: boolean;
}) {
  const navigate = useNavigate();
  const optionResource = useApiResource("/api/options", workspaceOptionsSchema);
  const administrationResource = useApiResource("/api/metadata", administrationSchema);
  const options = optionResource.data, administration = administrationResource.data;
  // A board reads the person's team until they explicitly choose another.
  // Keep that default local so restoring controls cannot race their choice.
  const layoutQuery = issueListLayoutQuery(query, layout);
  const shownQuery =
    layout === "board" && layoutQuery.team === "all" && options && administration && preferredTeam(options, administration)
      ? { ...layoutQuery, team: preferredTeam(options, administration) }
      : layoutQuery;
  useEffect(() => {
    if (
      shownQuery.pageSize !== query.pageSize ||
      shownQuery.grouping !== query.grouping
    )
      onChange({
        pageSize: shownQuery.pageSize,
        grouping: shownQuery.grouping,
        offset: query.offset,
      });
  }, [query, shownQuery, onChange]);
  const resource = useApiResource(
    issueListApiUrl(shownQuery),
    issueListSchema,
    5000,
    { abortPendingOnDispose: false },
  );
  useEffect(() => {
    const changed = () => resource.refreshAfterMutation();
    window.addEventListener("vector:issues-changed", changed);
    return () => window.removeEventListener("vector:issues-changed", changed);
  }, [resource.refreshAfterMutation]);
  const needsTeam = layout === "board" && layoutQuery.team === "all";
  const teamError = needsTeam ? optionResource.error || administrationResource.error : null;
  const waitingForTeam = needsTeam && (!options || !administration);
  return (
    <IssueListView
      query={shownQuery}
      {...resource}
      data={waitingForTeam || teamError ? null : resource.data}
      error={teamError || resource.error}
      loading={!teamError && (waitingForTeam || resource.loading)}
      // Row mutations also publish issues-changed. Join that draining refresh
      // instead of canceling its read with a second explicit reload.
      reload={() => {
        if (needsTeam) { optionResource.reload(); administrationResource.reload(); }
        void resource.refreshAfterMutation();
      }}
      layout={layout}
      title={title}
      viewActions={viewActions}
      onChange={onChange}
      onOpen={onOpen}
      onReset={onReset}
      description={description}
      before={<>{before}<SubscriptionFilters team={shownQuery.team} label={shownQuery.label}/></>}
      rowAction={rowAction && ((issue) => rowAction(issue, resource.refreshAfterMutation))}
      onSwitchLayout={switchLayout ? () =>
        void navigate({ to: layout === "board" ? "/app/issues" : "/app/board" }) : undefined}
      onCreateView={(viewId) =>
        void navigate({ to: "/app/views/$viewId", params: { viewId } })
      }
    />
  );
}
