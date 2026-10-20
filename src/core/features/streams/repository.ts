import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { dueIntakeQuery } from '../intake-return/repository'
import {
  cycles,
  evidenceRevisions,
  intakeDecisions,
  issueActivity,
  issueDependencies,
  issueLabels,
  issues,
  labels,
  listPreferences,
  operators,
  projects,
  projectLabels,
  projectMilestones,
  savedViews,
  teams,
  workflowStatuses,
  workspaceSettings,
} from '../../platform/db/schema'

export async function loadWorkspaceSnapshot(binding: D1Database) {
  return (await readWorkspaceSnapshot(binding)).snapshot
}

/** Current needs due candidates and the graph from the same fresh transaction. */
export function loadCurrentWorkspaceSnapshot(binding: D1Database, dueAt: string) {
  return readWorkspaceSnapshot(binding, dueAt)
}

async function readWorkspaceSnapshot(binding: D1Database, dueAt?: string) {
  const db = drizzle(binding)
  const queries = [
    db.select().from(workspaceSettings).limit(1),
    db.select().from(operators),
    db.select().from(teams),
    db.select().from(workflowStatuses),
    db.select().from(projects),
    db.select().from(cycles),
    db.select().from(labels),
    db.select().from(issues),
    db.select().from(issueLabels),
    db.select().from(issueDependencies),
    db.select().from(evidenceRevisions),
    db.select().from(intakeDecisions),
    db.select().from(issueActivity),
    db.select().from(savedViews),
    db.select().from(listPreferences),
    db.select().from(projectLabels),
    db.select().from(projectMilestones),
  ] as const
  const [workspace, operatorRows, teamRows, statusRows, projectRows, cycleRows, labelRows, issueRows, issueLabelRows, dependencyRows, evidenceRows, decisionRows, activityRows, savedViewRows, preferenceRows, projectLabelRows, projectMilestoneRows, candidates = []] = dueAt === undefined
    ? await db.batch(queries)
    : await db.batch([...queries, dueIntakeQuery(db, dueAt)])

  const snapshot = {
    workspace: workspace[0] ?? null,
    operators: operatorRows,
    teams: teamRows,
    statuses: statusRows,
    projects: projectRows,
    cycles: cycleRows,
    labels: labelRows,
    issues: issueRows,
    issueLabels: issueLabelRows,
    dependencies: dependencyRows,
    evidence: evidenceRows,
    decisions: decisionRows,
    activity: activityRows,
    savedViews: savedViewRows,
    preferences: preferenceRows,
    projectLabels: projectLabelRows,
    projectMilestones: projectMilestoneRows,
  }
  return { snapshot, candidates }
}

export async function findIssueByIdentifier(binding: D1Database, identifier: string) {
  const db = drizzle(binding)
  const [issue] = await db.select().from(issues).where(eq(issues.identifier, identifier)).limit(1)
  return issue ?? null
}
