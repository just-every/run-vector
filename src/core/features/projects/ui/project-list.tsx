import { useDateFormat } from "../../../shared/date-format";
import {ProjectTemplateLauncher} from '../../project-templates/controls';
import { ProjectAppearance } from "./project-appearance";
import type { Administration } from "../../administration/schema";
import "./project-rows.css";
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
  administration: Administration;
  onChanged: () => void;
  sort: string;
  onSortChange: (sort: string) => void;
  onFiltersChange: (filters: PortfolioFilters) => void;
  preferenceControls: ListPreferenceControlsProps;
};

export function ProjectList({
  projects,
  hasProjects,
  filters,
  lifecycleOptions,
  administration,
  onChanged,
  sort,
  onSortChange,
  onFiltersChange,
  preferenceControls,
}: ProjectListProps) {
  const ready = useHydrated() && preferenceControls.ready;
  return (
    <>
      {!["guest","viewer"].includes(administration.viewer.role) && <ProjectTemplateLauncher onChanged={onChanged} />}
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
        <label>Project lead<select aria-label="Filter project lead" disabled={!ready} value={filters.lead} onChange={event=>onFiltersChange({...filters,lead:event.target.value})}>
          <option value="all">All leads</option>{administration.operators.map(operator=><option key={operator.id} value={operator.id}>{operator.name}</option>)}
        </select></label>
        <label>Contributing team<select aria-label="Contributing team" disabled={!ready} value={filters.team} onChange={event=>onFiltersChange({...filters,team:event.target.value})}>
          <option value="all">All teams</option>{administration.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}
        </select></label>
        <label>Target from<input aria-label="Target from" type="date" disabled={!ready} value={filters.targetFrom} onChange={event=>onFiltersChange({...filters,targetFrom:event.target.value})} /></label>
        <label>Target through<input aria-label="Target through" type="date" disabled={!ready} value={filters.targetTo} onChange={event=>onFiltersChange({...filters,targetTo:event.target.value})} /></label>
        <label>Project label<select aria-label="Project label" disabled={!ready} value={filters.label} onChange={event=>onFiltersChange({...filters,label:event.target.value})}>
          <option value="all">All project labels</option>{administration.labels.filter(label=>label.projectsEnabled).map(label=><option key={label.id} value={label.id}>{label.name}</option>)}
        </select></label>
        <label>Sort projects<select aria-label="Sort projects" disabled={!ready} value={sort} onChange={event=>onSortChange(event.target.value)}><option value="newest">Name</option><option value="priority">Priority</option></select></label>
        <ListPreferenceControls {...preferenceControls} ready={ready} />
      </div>
      <section className="project-list" aria-label="Projects">
        {!hasProjects ? (
          <div className="projects-empty">
            <h2>{["guest","viewer"].includes(administration.viewer.role) ? "No visible projects" : "Create your first project"}</h2>
            {!["guest","viewer"].includes(administration.viewer.role) && <p>Choose New project to start planning your work.</p>}
          </div>
        ) : projects.length === 0 ? (
          <p className="projects-empty">No projects match these filters.</p>
        ) : (
          projects.map((project) => <div key={project.id} className="project-list-item"><ProjectRow project={project} /></div>)
        )}
      </section>
    </>
  );
}

function ProjectRow({ project }: { project: ProjectSummaryData }) {
  const health = activeHealthLabel(project.health);
  const { date } = useDateFormat();
  const chips = [
    ...(health ? [{ name: health, className: `project-health project-health--${project.health}` }] : []),
    ...(project.lifecycle !== "active" ? [{ name: lifecycleLabel(project.lifecycle), className: "project-lifecycle" }] : []),
    ...project.labels.map(label => ({ name: label.name, className: "project-lifecycle" })),
  ];
  return <Link className="project-row project-row--condensed" to="/app/projects/$projectId" params={{ projectId: project.id }} aria-label={`Open ${project.name}`}>
    <strong className="project-name"><ProjectAppearance color={project.color} icon={project.icon} />{project.name}</strong>
    <small className="project-row-meta">
      <span className="project-row__lead">{project.lead.name}</span>
      {chips[0] && <span className={chips[0].className}>{chips[0].name}</span>}
      {chips.length > 1 && <span aria-label={`${chips.length - 1} more labels and states`}>+{chips.length - 1}</span>}
      {project.priority !== "none" && <span>{lifecycleLabel(project.priority)}</span>}
      {project.startDate && <span>Starts {date(project.startDate)}</span>}
      {project.targetDate && <span>Target {date(project.targetDate)}</span>}
      <span className="project-row__progress">{projectProgressLabel(project)}</span>
    </small>
  </Link>;
}
