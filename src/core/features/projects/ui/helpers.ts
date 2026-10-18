import type { ProjectHealthData, ProjectSummaryData } from './data'

export type PortfolioFilters = {
  lifecycle: string
  health: 'all' | Exclude<ProjectHealthData, 'none'>
  includeArchived: boolean
  label: string
  lead: string
  team: string
  targetFrom: string
  targetTo: string
}

export const defaultPortfolioFilters: PortfolioFilters = {
  lifecycle: 'all',
  health: 'all',
  includeArchived: false,
  label: 'all',
  lead: 'all',
  team: 'all',
  targetFrom: '',
  targetTo: '',
}

export function filterProjects(
  projects: ProjectSummaryData[],
  filters: Pick<PortfolioFilters, 'lifecycle' | 'health' | 'label' | 'lead' | 'team' | 'targetFrom' | 'targetTo'>,
  sort = 'newest',
) {
  return projects.filter(
    (project) =>
      (filters.lifecycle === 'all' ||
        project.lifecycle === filters.lifecycle) &&
      (filters.health === 'all' || project.health === filters.health) &&
      (filters.label === 'all' || project.labels.some(label=>label.id===filters.label)) &&
      (filters.lead === 'all' || project.lead.id===filters.lead) &&
      (filters.team === 'all' || project.teamIds.includes(filters.team)) &&
      (!filters.targetFrom || (project.targetDate !== null && project.targetDate >= filters.targetFrom)) &&
      (!filters.targetTo || (project.targetDate !== null && project.targetDate <= filters.targetTo)),
  ).sort((a,b)=>(sort==='priority' ? ['urgent','high','medium','low','none'].indexOf(a.priority)-['urgent','high','medium','low','none'].indexOf(b.priority) : 0)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
}

export function portfolioMetrics(projects: ProjectSummaryData[]) {
  return {
    total: projects.length,
    blocked: projects.filter((project) => project.health === 'blocked').length,
    atRisk: projects.filter((project) => project.health === 'at-risk').length,
    onTrack: projects.filter((project) => project.health === 'on-track').length,
    unknown: projects.filter((project) => project.health === 'unknown').length,
  }
}

export function activeHealthLabel(health: ProjectHealthData) {
  if (health === 'blocked') return 'Blocked'
  if (health === 'at-risk') return 'At risk'
  if (health === 'on-track') return 'On track'
  if (health === 'unknown') return 'Unknown'
  return null
}

export function lifecycleLabel(lifecycle: string) {
  return lifecycle
    .replace(/(^|[-_\s])\p{L}/gu, (letter) => letter.toUpperCase())
    .replaceAll('-', ' ')
}

export function projectProgressLabel(project: ProjectSummaryData) {
  return project.progress.percentage === null
    ? 'No countable issues'
    : `${project.progress.completed}/${project.progress.total} complete · ${project.progress.percentage}%`
}

export function shortProjectDate(value: string | null) {
  if (value === null) return 'No target date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}
