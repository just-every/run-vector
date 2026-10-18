import { useHydrated } from "../../../app/initial-resources";
import { useRef, useState } from "react";
import { useApiResource } from "../../../app/api-client";
import type { ListPreferenceControlsProps } from "../../views/ui/list-preference-controls";
import { useListPreferences } from "../../views/ui/use-list-preferences";
import { projectPortfolioSchema } from "./data";
import {
  defaultPortfolioFilters,
  filterProjects,
  portfolioMetrics,
} from "./helpers";
import { administrationSchema } from "../../administration/schema";
import { ProjectCreate } from "./project-administration";
import { ProjectList } from "./project-list";

export function ProjectsWorkspace() {
  const hydrated = useHydrated();
  const [creating, setCreating] = useState(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const closeCreate = () => {
    setCreating(false);
    createTrigger.current?.focus();
  };
  const preferences = useListPreferences("projects", {
    filters: defaultPortfolioFilters,
    sort: "newest" as string,
    grouping: "none",
  });
  const filters = preferences.filters;
  const includeArchived = filters.includeArchived;
  const preferenceControls: ListPreferenceControlsProps = {
    ready: preferences.ready,
    loading: preferences.loading,
    saving: preferences.saving,
    loadError: preferences.loadError,
    saveError: preferences.saveError,
    onRetryLoad: preferences.retryLoad,
    onRetrySave: preferences.retrySave,
    onReset: preferences.reset,
  };
  const administration = useApiResource(
    "/api/settings/administration",
    administrationSchema,
  );
  const portfolio = useApiResource(
    `/api/projects${includeArchived ? "?includeArchived=true" : ""}`,
    projectPortfolioSchema,
  );
  const changed = () => {
    administration.reload();
    portfolio.reload();
  };
  if (portfolio.loading && portfolio.data === null)
    return (
      <main className="projects-state" aria-live="polite">
        Loading Projects…
      </main>
    );
  if (portfolio.error || portfolio.data === null)
    return (
      <main className="projects-state projects-state--error" role="alert">
        <strong>Unable to load Projects.</strong>
        <span>{portfolio.error?.message}</span>
        <button type="button" onClick={portfolio.reload}>
          Try again
        </button>
      </main>
    );
  if (
    administration.loading &&
    administration.data === null &&
    !administration.error
  )
    return (
      <main className="projects-state" aria-live="polite">
        Loading Projects…
      </main>
    );
  if (administration.error || administration.data === null)
    return (
      <main className="projects-state projects-state--error" role="alert">
        <strong>Unable to load project information.</strong>
        <span>{administration.error?.message}</span>
        <button type="button" onClick={administration.reload}>
          Retry administration
        </button>
      </main>
    );
  const projects = filterProjects(portfolio.data.projects, filters, preferences.sort);
  const metrics = portfolioMetrics(projects);
  const lifecycleOptions = [
    ...new Set(portfolio.data.projects.map((project) => project.lifecycle)),
  ].sort();
  return (
    <main className="projects-workspace" aria-labelledby="projects-title">
      <header className="projects-header">
        <div>
          <p className="stream-overline">Portfolio</p>
          <h1 id="projects-title">Projects</h1>
          <p>
            Health is calculated from current scope, dependencies, target dates,
            and cycle capacity.
          </p>
        </div>
        <button
          ref={createTrigger}
          className="projects-new-project"
          disabled={!hydrated}
          type="button"
          aria-expanded={creating}
          aria-controls="project-create-panel"
          onClick={() => setCreating(true)}
        >
          New project
        </button>
      </header>
      {creating && (
        <section
          id="project-create-panel"
          className="administration-panel project-detail__section"
          aria-label="Project administration"
        >
          <h2>Create project</h2>
          <ProjectCreate
            operators={administration.data.operators}
            labels={administration.data.labels}
            onChanged={() => {
              changed();
              closeCreate();
            }}
            onCancel={closeCreate}
          />
        </section>
      )}
      <label className="projects-archived-filter">
        <input
          type="checkbox"
          checked={includeArchived}
          disabled={!hydrated || !preferences.ready}
          onChange={(event) =>
            preferences.update({
              filters: { ...filters, includeArchived: event.target.checked },
            })
          }
        />{" "}
        Include archived projects
      </label>
      <section className="project-metrics" aria-label="Portfolio metrics">
        <Metric label="Projects" value={metrics.total} />
        <Metric label="Blocked" value={metrics.blocked} tone="blocked" />
        <Metric label="At risk" value={metrics.atRisk} tone="at-risk" />
        <Metric label="On track" value={metrics.onTrack} tone="on-track" />
        <Metric label="Unknown" value={metrics.unknown} tone="unknown" />
      </section>
      <div className="project-lifecycle-counts" aria-label="Lifecycle counts">{["planned","active","completed","canceled"].map(lifecycle=><span key={lifecycle}>{lifecycle[0].toUpperCase()+lifecycle.slice(1)}: {projects.filter(project=>project.lifecycle===lifecycle).length}</span>)}</div>
      <ProjectList
        projects={projects}
        hasProjects={administration.data.projects.length > 0}
        filters={filters}
        lifecycleOptions={lifecycleOptions}
        administration={administration.data}
        onChanged={changed}
        sort={preferences.sort}
        onSortChange={sort=>preferences.update({sort})}
        onFiltersChange={(next) => preferences.update({ filters: next })}
        preferenceControls={preferenceControls}
      />
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={`project-metric${tone ? ` project-metric--${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
