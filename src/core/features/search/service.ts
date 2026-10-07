import { loadWorkspaceSnapshot } from '../streams'

export async function searchWorkspace(
  binding: D1Database,
  operatorId: string,
  query: string,
  includeArchived: boolean,
) {
  const snapshot = await loadWorkspaceSnapshot(binding)
  const term = query.trim().toLocaleLowerCase()
  if (!term) return { issues: [], projects: [], savedViews: [] }
  const exactIdentifier = snapshot.issues.find(
    (issue) => issue.identifier.toLocaleLowerCase() === term,
  )
  const issues = snapshot.issues.filter((issue) => {
    const team = snapshot.teams.find((item) => item.id === issue.teamId)
    const project =
      issue.projectId === null
        ? null
        : (snapshot.projects.find((item) => item.id === issue.projectId) ??
          null)
    if (!includeArchived && (team?.archivedAt || project?.archivedAt))
      return false
    const labels = snapshot.issueLabels
      .filter((entry) => entry.issueId === issue.id)
      .map(
        (entry) =>
          snapshot.labels.find((label) => label.id === entry.labelId)?.name ??
          '',
      )
    const evidence = snapshot.evidence
      .filter((item) => item.issueId === issue.id)
      .map((item) => item.summary)
    return [
      issue.identifier,
      issue.title,
      issue.description,
      issue.expectedOutcome ?? '',
      issue.customerImpact ?? '',
      ...labels,
      ...evidence,
    ].some((value) => value.toLocaleLowerCase().includes(term))
  })
  const orderedIssues = exactIdentifier
    ? [
        exactIdentifier,
        ...issues.filter((issue) => issue.id !== exactIdentifier.id),
      ]
    : issues
  return {
    issues: orderedIssues.map((issue) => ({
      identifier: issue.identifier,
      title: issue.title,
      id: issue.id,
    })),
    projects: snapshot.projects
      .filter(
        (project) =>
          (includeArchived || project.archivedAt === null) &&
          project.name.toLocaleLowerCase().includes(term),
      )
      .map((project) => ({ id: project.id, name: project.name })),
    savedViews: snapshot.savedViews
      .filter(
        (view) =>
          (view.isShared || view.ownerOperatorId === operatorId) &&
          view.name.toLocaleLowerCase().includes(term),
      )
      .map((view) => ({
        id: view.id,
        name: view.name,
        isShared: view.isShared,
      })),
  }
}

export async function getSearchOptions(
  binding: D1Database,
  operatorId: string,
) {
  const snapshot = await loadWorkspaceSnapshot(binding)
  const workspace = snapshot.workspace
  const operator = snapshot.operators.find((item) => item.id === operatorId)
  if (!workspace || !operator)
    throw new Error(
      'Workspace options require an active workspace and operator.',
    )
  return {
    workspace: { id: workspace.id, name: workspace.name },
    operator: { id: operator.id },
    teams: snapshot.teams
      .filter((team) => team.archivedAt === null)
      .map(({ id, name, identifierPrefix }) => ({
        id,
        name,
        identifierPrefix,
      })),
    operators: snapshot.operators
      .filter((operator) => operator.removedAt === null)
      .map(({ id, name }) => ({ id, name })),
    labels: snapshot.labels.map(({ id, name, color }) => ({ id, name, color })),
    projects: snapshot.projects
      .filter((project) => project.archivedAt === null)
      .map(({ id, name, lifecycle }) => ({ id, name, lifecycle })),
    statuses: snapshot.statuses.map(
      ({ id, teamId, name, category, position }) => ({
        id,
        teamId,
        name,
        category,
        position,
      }),
    ),
    cycles: snapshot.cycles
      .filter((cycle) => cycle.closedAt === null)
      .map(({ id, teamId, name, startsAt, endsAt }) => ({
        id,
        teamId,
        name,
        startsAt,
        endsAt,
      })),
    savedViews: snapshot.savedViews
      .filter((view) => view.isShared || view.ownerOperatorId === operatorId)
      .map(({ id, name, isShared, surface }) => ({
        id,
        name,
        isShared,
        surface,
      })),
  }
}
