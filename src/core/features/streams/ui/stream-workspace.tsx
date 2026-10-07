import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ApiError, useApiResource } from "../../../app/api-client";
import { IssueDetail } from "../../issues/ui/issue-detail";
import {
  currentStreamSchema,
  myWorkSchema,
  optionsSchema,
  type StreamItem,
  type CycleContextData,
} from "./data";
import { filterItems, type StreamFilters } from "./helpers";
import { StreamList } from "./stream-list";

type StreamWorkspaceProps = {
  surface: "current" | "my-work";
  selectedIdentifier?: string;
};

const defaultFilters: StreamFilters = {
  teamId: "all",
  assigneeId: "all",
  priority: "all",
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
  const stream = useApiResource("/api/current", currentStreamSchema, 5000);
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
      onRefresh={stream.reload}
      refreshError={stream.error}
    />
  );
}

function MyWorkWorkspace({
  selectedIdentifier,
}: {
  selectedIdentifier?: string;
}) {
  const stream = useApiResource("/api/my-work", myWorkSchema);
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
      onRefresh={stream.reload}
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
  const options = useApiResource("/api/options", optionsSchema);
  const [filters, setFilters] = useState(defaultFilters);
  const filteredGroups = groups.map((group) => ({
    ...group,
    items: filterItems(group.items, filters),
  }));
  const allItems = filteredGroups.flatMap((group) => group.items);
  const detailIdentifier = selectedIdentifier ?? allItems[0]?.identifier;
  const open = (identifier: string) =>
    navigate({
      to:
        surface === "current"
          ? "/app/current/$identifier"
          : "/app/my-work/$identifier",
      params: { identifier },
    });
  const back = () =>
    navigate({ to: surface === "current" ? "/app" : "/app/my-work" });
  return (
    <main
      className={`stream-workspace${selectedIdentifier ? " has-mobile-detail" : ""}`}
      aria-label={surface === "current" ? "Current" : "My work"}
    >
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
        <div className="stream-master">
          <FilterBar
            personal={surface === "my-work"}
            filters={filters}
            onChange={setFilters}
            options={options.data}
            loading={options.loading}
          />
          <StreamList
            hideAssignee={surface === "my-work"}
            groups={filteredGroups}
            selectedIdentifier={selectedIdentifier}
            onOpen={open}
          />
        </div>
        <section
          className={`stream-detail${selectedIdentifier ? "" : " stream-detail--default"}`}
          aria-label="Issue detail"
        >
          {detailIdentifier ? (
            <IssueDetail
              identifier={detailIdentifier}
              onBack={selectedIdentifier ? back : undefined}
              onChanged={onRefresh}
            />
          ) : (
            <EmptyState surface={surface} />
          )}
        </section>
      </div>
    </main>
  );
}

function FilterBar({
  filters,
  onChange,
  options,
  loading,
  personal,
}: {
  personal: boolean;
  filters: StreamFilters;
  onChange: (filters: StreamFilters) => void;
  options: {
    teams: Array<{ id: string; name: string }>;
    operators: Array<{ id: string; name: string }>;
  } | null;
  loading: boolean;
}) {
  return (
    <div className="stream-filters" aria-label="Filter stream">
      <label>
        Team
        <select
          value={filters.teamId}
          disabled={loading || options === null}
          onChange={(event) =>
            onChange({ ...filters, teamId: event.target.value })
          }
        >
          <option value="all">All teams</option>
          {options?.teams.map((team) => (
            <option value={team.id} key={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      {!personal ? (
        <label>
          Assignee
          <select
            value={filters.assigneeId}
            disabled={loading || options === null}
            onChange={(event) =>
              onChange({ ...filters, assigneeId: event.target.value })
            }
          >
            <option value="all">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {options?.operators.map((operator) => (
              <option value={operator.id} key={operator.id}>
                {operator.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Priority
        <select
          value={filters.priority}
          onChange={(event) =>
            onChange({ ...filters, priority: event.target.value })
          }
        >
          <option value="all">Any priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="none">No priority</option>
        </select>
      </label>
    </div>
  );
}

function CycleContext({ cycles }: { cycles: CycleContextData[] }) {
  if (cycles.length === 0) return null;
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  return (
    <div className="cycle-context" aria-label="Active cycle context">
      {cycles.map((cycle) => {
        const date = new Intl.DateTimeFormat(undefined, {
          timeZone: cycle.timezone,
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        });
        const capacityLabel =
          cycle.capacityRisk === "unknown"
            ? "Capacity unknown"
            : cycle.capacityRisk === "at-risk"
              ? "At risk"
              : "Within capacity";
        const capacityFacts = [
          cycle.remainingPoints !== null
            ? `${number.format(cycle.remainingPoints)} points remaining`
            : null,
          cycle.capacity !== null
            ? `${number.format(cycle.capacity)} points capacity`
            : "Capacity not set",
          cycle.unestimatedRemaining > 0
            ? `${number.format(cycle.unestimatedRemaining)} remaining ${cycle.unestimatedRemaining === 1 ? "issue" : "issues"} unestimated`
            : null,
        ].filter((fact): fact is string => fact !== null);
        return (
          <div key={cycle.id}>
            <span>
              {cycle.team} · {cycle.name}
            </span>
            <strong>
              {cycle.percentage === null ? (
                "No committed work"
              ) : (
                <>
                  {number.format(cycle.completed)}/{number.format(cycle.total)}{" "}
                  {cycle.unit === "points"
                    ? "points"
                    : "issues · by issue count"}{" "}
                  · {number.format(cycle.percentage)}%
                </>
              )}
            </strong>
            <small className="cycle-dates">
              <time dateTime={cycle.startsAt}>
                {date.format(new Date(cycle.startsAt))}
              </time>{" "}
              –{" "}
              <time dateTime={cycle.endsAt}>
                {date.format(new Date(cycle.endsAt))}
              </time>
              <span className="cycle-timezone">{cycle.timezone}</span>
            </small>
            <small className="cycle-capacity" data-risk={cycle.capacityRisk}>
              {capacityLabel} · {capacityFacts.join(" · ")}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <main className="app-state" aria-live="polite">
      <span className="app-spinner" aria-hidden="true" />
      {label}…
    </main>
  );
}
function ErrorState({
  error,
  onRetry,
  returnTo,
}: {
  error: Error | null;
  onRetry: () => void;
  returnTo: string;
}) {
  return (
    <main className="app-state app-state--error" role="alert">
      <strong>Unable to load this workspace.</strong>
      <span>{error?.message}</span>
      {error instanceof ApiError && error.status === 401 ? (
        <a href={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in again
        </a>
      ) : (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </main>
  );
}
function EmptyState({ surface }: { surface: "current" | "my-work" }) {
  return (
    <div className="stream-empty-detail">
      <h2>
        {surface === "my-work"
          ? "You're all caught up"
          : "No issues match these filters"}
      </h2>
      <p>
        {surface === "my-work"
          ? "Nothing assigned to you needs attention right now."
          : "Adjust a filter to see the rest of the stream."}
      </p>
    </div>
  );
}

export function allStreamItems(groups: Array<{ items: StreamItem[] }>) {
  return groups.flatMap((group) => group.items);
}
