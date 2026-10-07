import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
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
  savedViews,
  teams,
  workflowStatuses,
  workspaceSettings,
} from '../../platform/db/schema'

export async function loadWorkspaceSnapshot(binding: D1Database) {
  const db = drizzle(binding)
  const [workspace, operatorRows, teamRows, statusRows, projectRows, cycleRows, labelRows, issueRows, issueLabelRows, dependencyRows, evidenceRows, decisionRows, activityRows, savedViewRows, preferenceRows] = await Promise.all([
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
  ])

  return {
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
  }
}

export async function findIssueByIdentifier(binding: D1Database, identifier: string) {
  const db = drizzle(binding)
  const [issue] = await db.select().from(issues).where(eq(issues.identifier, identifier)).limit(1)
  return issue ?? null
}
