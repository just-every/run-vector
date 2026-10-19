import { useViewerTime } from '../../../app/viewer-time';
import { useHydrated } from "../../../app/initial-resources";
import { ListPreferenceControls, type ListPreferenceControlsProps } from "../../views/ui/list-preference-controls";
import { attentionReasons, reasonLabel, type StreamFilters } from "./helpers";
import type { CycleContextData } from "./data";

export function FilterBar({
  filters,
  onChange,
  options,
  loading,
  personal,
  preferenceControls,
}: {
  personal: boolean;
  filters: StreamFilters;
  onChange: (filters: StreamFilters) => void;
  options: {
    teams: Array<{ id: string; name: string }>;
    operators: Array<{ id: string; name: string }>;
    projects: Array<{ id: string; name: string }>;
  } | null;
  loading: boolean;
  preferenceControls: ListPreferenceControlsProps;
}) {
  const hydrated = useHydrated();
  const controlsDisabled = !hydrated || !preferenceControls.ready || loading || options === null;
  return (
    <div className="stream-filters" aria-label="Filter stream">
      <label>
        Team
        <select
          aria-label="Team"
          value={filters.teamId}
          disabled={controlsDisabled}
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
      <label>
        Project
        <select
          aria-label="Project"
          value={filters.projectId}
          disabled={controlsDisabled}
          onChange={(event) => onChange({ ...filters, projectId: event.target.value })}
        >
          <option value="all">All projects</option>
          <option value="none">No project</option>
          {options?.projects.map((project) => (
            <option value={project.id} key={project.id}>{project.name}</option>
          ))}
        </select>
      </label>
      {!personal ? (
        <label>
          Assignee
          <select
            aria-label="Assignee"
            value={filters.assigneeId}
            disabled={controlsDisabled}
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
          aria-label="Priority"
          value={filters.priority}
          disabled={!hydrated || !preferenceControls.ready}
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
      <label>
        Item type
        <select
          aria-label="Item type"
          value={filters.itemType}
          disabled={!hydrated || !preferenceControls.ready}
          onChange={(event) => onChange({ ...filters, itemType: event.target.value as StreamFilters["itemType"] })}
        >
          <option value="all">All items</option>
          <option value="intake">Intake</option>
          <option value="issue">Issue</option>
        </select>
      </label>
      <label>
        Attention reason
        <select
          aria-label="Attention reason"
          value={filters.attentionReason}
          disabled={!hydrated || !preferenceControls.ready}
          onChange={(event) => onChange({ ...filters, attentionReason: event.target.value })}
        >
          <option value="all">Any reason</option>
          {attentionReasons.map((reason) => (
            <option value={reason} key={reason}>{reasonLabel(reason)}</option>
          ))}
        </select>
      </label>
      <ListPreferenceControls {...preferenceControls} ready={preferenceControls.ready && hydrated} />
    </div>
  );
}

export function CycleContext({ cycles }: { cycles: CycleContextData[] }) {
  const { effectiveTimezone } = useViewerTime();
  if (cycles.length === 0) return null;
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: effectiveTimezone, year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  return (
    <div className="cycle-context" aria-label="Active cycle context">
      {cycles.map((cycle) => {
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
              <span className="cycle-timezone">{effectiveTimezone}</span>
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

