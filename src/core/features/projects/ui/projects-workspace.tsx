import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useApiResource } from '../../../app/api-client'
import { projectPortfolioSchema } from './data'
import {
  defaultPortfolioFilters,
  filterProjects,
  portfolioMetrics,
} from './helpers'
import { ProjectList } from './project-list'

export function ProjectsWorkspace() {
  const portfolio = useApiResource('/api/projects', projectPortfolioSchema)
  const [filters, setFilters] = useState(defaultPortfolioFilters)
  if (portfolio.loading && portfolio.data === null)
    return (
      <main className="projects-state" aria-live="polite">
        Loading Projects…
      </main>
    )
  if (portfolio.error || portfolio.data === null)
    return (
      <main className="projects-state projects-state--error" role="alert">
        <strong>Unable to load Projects.</strong>
        <span>{portfolio.error?.message}</span>
        <button type="button" onClick={portfolio.reload}>
          Try again
        </button>
      </main>
    )
  const projects = filterProjects(portfolio.data.projects, filters)
  const metrics = portfolioMetrics(projects)
  const lifecycleOptions = [
    ...new Set(portfolio.data.projects.map((project) => project.lifecycle)),
  ].sort()
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
        <Link className="projects-new-issue" to="/app/new-issue">
          New issue
        </Link>
      </header>
      <section className="project-metrics" aria-label="Portfolio metrics">
        <Metric label="Projects" value={metrics.total} />
        <Metric label="Blocked" value={metrics.blocked} tone="blocked" />
        <Metric label="At risk" value={metrics.atRisk} tone="at-risk" />
        <Metric label="On track" value={metrics.onTrack} tone="on-track" />
        <Metric label="Unknown" value={metrics.unknown} tone="unknown" />
      </section>
      <ProjectList
        projects={projects}
        filters={filters}
        lifecycleOptions={lifecycleOptions}
        onFiltersChange={setFilters}
      />
    </main>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className={`project-metric${tone ? ` project-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
