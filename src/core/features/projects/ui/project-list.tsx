import { useHydrated } from "../../../app/initial-resources";
import { Link } from "@tanstack/react-router";
import type { PortfolioFilters } from "./helpers";
import {
  ListPreferenceControls,
  type ListPreferenceControlsProps,
} from "../../views/ui/list-preference-controls";
import {
  activeHealthLabel,
  lifecycleLabel,
  projectProgressLabel,
} from "./helpers";
import type { ProjectSummaryData } from "./data";

type ProjectListProps = {
  projects: ProjectSummaryData[];
  hasProjects: boolean;
  filters: PortfolioFilters;
  lifecycleOptions: string[];
  onFiltersChange: (filters: PortfolioFilters) => void;
  preferenceControls: ListPreferenceControlsProps;
};

export function ProjectList({
  projects,
  hasProjects,
  filters,
  lifecycleOptions,
  onFiltersChange,
  preferenceControls,
}: ProjectListProps) {
  const ready = useHydrated() && preferenceControls.ready;
  return (
    <>
      <div className="project-filters" aria-label="Filter project portfolio">
        <label>
          Lifecycle
          <select
            aria-label="Lifecycle"
            disabled={!ready}
            value={filters.lifecycle}
            onChange={(event) =>
              onFiltersChange({ ...filters, lifecycle: event.target.value })
            }
          >
            <option value="all">All lifecycles</option>
            {lifecycleOptions.map((lifecycle) => (
              <option key={lifecycle} value={lifecycle}>
                {lifecycleLabel(lifecycle)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Health
          <select
            aria-label="Health"
            disabled={!ready}
            value={filters.health}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                health: event.target.value as PortfolioFilters["health"],
              })
            }
          >
            <option value="all">All active health</option>
            <option value="blocked">Blocked</option>
            <option value="at-risk">At risk</option>
            <option value="on-track">On track</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <ListPreferenceControls {...preferenceControls} ready={ready} />
      </div>
      <section className="project-list" aria-label="Projects">
        <div className="project-list-heading" aria-hidden="true">
          <span>Project</span>
          <span>Lead</span>
          <span>Progress</span>
          <span>Health</span>
        </div>
        {!hasProjects ? (
          <div className="projects-empty">
            <h2>Create your first project</h2>
            <p>Choose New project to start planning your work.</p>
          </div>
        ) : projects.length === 0 ? (
          <p className="projects-empty">No projects match these filters.</p>
        ) : (
          projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))
        )}
      </section>
    </>
  );
}

function ProjectRow({ project }: { project: ProjectSummaryData }) {
  const health = activeHealthLabel(project.health);
  return (
    <Link
      className="project-row"
      to="/app/projects/$projectId"
      params={{ projectId: project.id }}
      aria-label={`Open ${project.name}`}
    >
      <span className="project-row__name">
        <strong>{project.name}</strong>
        <small>{project.description || "No description"}</small>
      </span>
      <span className="project-row__lead">{project.lead.name}</span>
      <span className="project-row__progress">
        <span>{projectProgressLabel(project)}</span>
        <i aria-hidden="true">
          <b style={{ width: `${project.progress.percentage ?? 0}%` }} />
        </i>
      </span>
      <span className="project-row__state">
        <span className="project-lifecycle">
          {lifecycleLabel(project.lifecycle)}
        </span>
        {health ? (
          <span className={`project-health project-health--${project.health}`}>
            {health}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
