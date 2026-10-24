import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useApiResource } from "../../../app/api-client";
import { IssueDetail } from "../../issues/ui/issue-detail";
import { useListPreferences } from "../../views/ui/use-list-preferences";
import {
  currentStreamSchema,
  myWorkSchema,
  optionsSchema,
  type StreamItem,
  type CycleContextData,
} from "./data";
import { defaultStreamFilters, filterItems } from "./helpers";
import { StreamList } from "./stream-list";
import { useStreamPlanningState } from "./stream-planning-state";
import { IssueKeyboard } from "../../issues/ui/issue-keyboard";
import { IssueBulk } from "../../issues/ui/issue-bulk";
import { useIssueRowFocus } from "../../issues/ui/issue-keyboard-focus";
import { refreshIssueSelection } from "../../issues/ui/issue-selection";
import { focusIssueRow } from "../../issues/ui/issue-browser-pane";
import "../../issues/ui/issues-browser.css";
import { FilterBar, CycleContext } from "./stream-controls";
import { LoadingState, ErrorState, EmptyState } from "./stream-states";
import { MyWorkTabs } from "../../my-work/ui/my-work-tabs";

type StreamWorkspaceProps = {
  surface: "current" | "my-work";
  selectedIdentifier?: string;
};

export function StreamWorkspace({
  surface,
  selectedIdentifier,
}: StreamWorkspaceProps) {
  return surface === "current" ? (
    <CurrentWorkspace selectedIdentifier={selectedIdentifier} />
  ) : (
    <MyWorkWorkspace selectedIdentifier={selectedIdentifier} />
  );
}

function CurrentWorkspace({
  selectedIdentifier,
}: {
  selectedIdentifier?: string;
}) {
  // Leave room for request and render latency within Current's five-second freshness budget.
  const stream = useApiResource("/api/current", currentStreamSchema, 2000, {
    // A route change stops polling; let a read already admitted by this
    // document finish, as the issue browser does, without canceling its I/O.
    abortPendingOnDispose: false,
  });
  if (stream.loading && stream.data === null)
    return <LoadingState label="Loading Current" />;
  if (stream.data === null)
    return (
      <ErrorState
        error={stream.error}
        onRetry={stream.reload}
        returnTo="/app"
      />
    );
  return (
    <WorkspaceContent
      surface="current"
      selectedIdentifier={selectedIdentifier}
      groups={[
        {
          id: "needs-decision",
          title: "Needs decision",
          items: stream.data.sections["needs-decision"],
        },
        { id: "now", title: "Now", items: stream.data.sections.now },
        { id: "next", title: "Next", items: stream.data.sections.next },
        {
          id: "recently-done",
          title: "Recently done",
          items: stream.data.sections["recently-done"],
        },
      ]}
      onRefresh={stream.refreshAfterMutation}
      refreshError={stream.error}
    />
  );
}

function MyWorkWorkspace({
  selectedIdentifier,
}: {
  selectedIdentifier?: string;
}) {
  const stream = useApiResource("/api/my-work", myWorkSchema, 2000);
  if (stream.loading && stream.data === null)
    return <LoadingState label="Loading My work" />;
  if (stream.data === null)
    return (
      <ErrorState
        error={stream.error}
        onRetry={stream.reload}
        returnTo="/app/my-work"
      />
    );
  return (
    <WorkspaceContent
      surface="my-work"
      selectedIdentifier={selectedIdentifier}
      subtitle={stream.data.operator.name}
      cycles={stream.data.cycles}
      groups={[
        {
          id: "waiting",
          title: "Waiting",
          items: stream.data.sections.waiting,
        },
        { id: "now", title: "Now", items: stream.data.sections.now },
        { id: "next", title: "Next", items: stream.data.sections.next },
      ]}
      onRefresh={stream.refreshAfterMutation}
      refreshError={stream.error}
    />
  );
}

function WorkspaceContent({
  surface,
  selectedIdentifier,
  groups,
  onRefresh,
  subtitle,
  cycles,
  refreshError,
}: {
  surface: "current" | "my-work";
  selectedIdentifier?: string;
  groups: Array<{ id: string; title: string; items: StreamItem[] }>;
  onRefresh: () => void;
  refreshError?: Error | null;
  subtitle?: string;
  cycles?: CycleContextData[];
}) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const detailPane = useRef<HTMLElement>(null);
  const ownedFocus = useIssueRowFocus(root);
  const planning = useStreamPlanningState(surface);
  const options = useApiResource("/api/options", optionsSchema);
  const preferences = useListPreferences(surface, {
    filters: defaultStreamFilters,
    sort: "priority",
    grouping: "none",
  });
  const filters = preferences.filters;
  const filteredGroups = useMemo(() => groups.map((group) => ({
    ...group,
    items: filterItems(group.items, filters),
  })), [groups, filters]);
  const allItems = useMemo(() => filteredGroups.flatMap((group) => group.items), [filteredGroups]);
  useEffect(() => {
    planning.setSelection(current => refreshIssueSelection(current, allItems));
  }, [allItems, planning.setSelection]);
  useEffect(() => {
    window.addEventListener("vector:issues-changed", onRefresh);
    return () => window.removeEventListener("vector:issues-changed", onRefresh);
  }, [onRefresh]);
  useEffect(() => { if (selectedIdentifier) detailPane.current?.focus(); }, [selectedIdentifier]);
  function updatedSelection(issues: Array<{ identifier: string; version: number }>) {
    planning.setSelection(current => {
      const next = new Map(current);
      issues.forEach(receipt => {
        const row = next.get(receipt.identifier);
        if (row) next.set(receipt.identifier, { ...row, version: receipt.version });
      });
      return next;
    });
  }
  const detailIdentifier = selectedIdentifier ?? allItems[0]?.identifier;
  const open = (identifier: string) =>
    navigate({
      to:
        surface === "current"
          ? "/app/current/$identifier"
          : "/app/my-work/$identifier",
      params: { identifier },
    });
  const back = async () => {
    const returnTo = allItems.some(row => row.identifier === selectedIdentifier) ? selectedIdentifier : allItems[0]?.identifier;
    await navigate({ to: surface === "current" ? "/app" : "/app/my-work" });
    if (returnTo) focusIssueRow(returnTo);
  };
  return (
    <main
      className={`stream-workspace${selectedIdentifier ? " has-mobile-detail" : ""}`}
      aria-label={surface === "current" ? "Current" : "My work"}
    >
      {surface === "my-work" ? <MyWorkTabs current="Assigned" /> : null}
      <header className="stream-header">
        <div>
          <p className="stream-overline">
            {surface === "current" ? "Shared attention" : subtitle}
          </p>
          <h1>{surface === "current" ? "Current" : "My work"}</h1>
        </div>
        {cycles ? <CycleContext cycles={cycles} /> : null}
      </header>
      {refreshError ? (
        <div className="issue-refresh-error" role="alert">
          <span>
            Changes could not be refreshed. The last loaded list remains
            visible.
          </span>
          <span>{refreshError.message}</span>
          <button type="button" onClick={onRefresh}>
            Retry refresh
          </button>
        </div>
      ) : null}
      <div className="stream-layout">
        <div ref={root} className="stream-master">
          <FilterBar
            personal={surface === "my-work"}
            filters={filters}
            onChange={(next) => preferences.update({ filters: next })}
            options={options.data}
            loading={options.loading}
            preferenceControls={{
              ready: preferences.ready,
              loading: preferences.loading,
              saving: preferences.saving,
              loadError: preferences.loadError,
              saveError: preferences.saveError,
              onRetryLoad: preferences.retryLoad,
              onRetrySave: preferences.retrySave,
              onReset: preferences.reset,
            }}
          />
          <div className="stream-planning">
            <IssueKeyboard root={root} rows={allItems} selection={planning.selection} focused={planning.focused}
              options={options.data} onRefresh={onRefresh} onSuccess={updatedSelection} />
            <IssueBulk selection={planning.selection} options={options.data} onRefresh={onRefresh}
              onSuccess={updatedSelection} onClear={() => planning.setSelection(new Map())}
              onRemove={identifier => planning.setSelection(current => { const next = new Map(current); next.delete(identifier); return next; })} />
          </div>
          <StreamList
            hideAssignee={surface === "my-work"}
            groups={filteredGroups}
            selectedIdentifier={selectedIdentifier}
            onOpen={open}
            selection={planning.selection} setSelection={planning.setSelection}
            focused={planning.focused} setFocused={planning.setFocused} ownedFocus={ownedFocus}
          />
        </div>
        <section
          ref={detailPane}
          tabIndex={-1}
          className={`stream-detail${selectedIdentifier || !allItems.length ? "" : " stream-detail--default"}`}
          aria-label="Issue detail"
        >
          {detailIdentifier ? (
            <IssueDetail
              identifier={detailIdentifier}
              onBack={selectedIdentifier ? back : undefined}
              onChanged={onRefresh}
            />
          ) : (
            <EmptyState
              surface={surface}
              filtered={Object.values(filters).some((value) => value !== "all")}
            />
          )}
        </section>
      </div>
    </main>
  );
}

