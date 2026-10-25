import type { AppEnvironment } from './bindings'
import type { WorkspaceProjection, WorkspaceSnapshot } from '../features/streams/snapshot'
import { defaultPreference, normalizePreference } from '../features/views/preferences'
import { discussionReadStatements, discussionProjection } from '../features/discussion/repository'
import { buildIssueDetail, issueDetailReadStatements, enrichIssueDetail } from '../features/issues/service'
import { IssueAccessError, issueAccessStatement, issueAccessProjection, type IssueAccessRow } from '../features/issues/access'
import { subscriptionStatement, subscriptionFromRow, type SubscriptionRow } from '../features/notifications/read'
import { githubIssueStatement, githubIssueFromRows } from '../features/integrations/github-read'

type Operator = AppEnvironment['Variables']['operator']

/** Only the stream's fresh graph may replace the normal read-route admission. */
export function admittedStreamSnapshot(workspace: WorkspaceProjection, operator: Operator) {
  const snapshot = workspace.snapshot
  const actor = snapshot?.operators.find(row => row.id === operator.id)
  return snapshot && actor && actor.removedAt === null &&
    actor.workspaceId === operator.workspaceId && snapshot.workspace?.id === actor.workspaceId
    ? snapshot : undefined
}

export function streamPreference(snapshot: WorkspaceSnapshot, actor: string, surface: 'current' | 'my-work') {
  const row = snapshot.preferences.find(row => row.operatorId === actor && row.surface === surface)
  return row ? normalizePreference(surface, {
    filters: JSON.parse(row.filtersJson), sort: row.sort, grouping: row.grouping,
  }) : defaultPreference(surface)
}

export async function selectedStreamResources(db: D1Database, snapshot: WorkspaceSnapshot, operator: Operator, identifier: string) {
  const issue = snapshot.issues.find(row => row.identifier === identifier)
  const team = issue && snapshot.teams.find(row => row.id === issue.teamId)
  if (!issue || team?.workspaceId !== operator.workspaceId) return null

  const detail = buildIssueDetail(snapshot, identifier, new Date())
  if (!detail) return null
  const [metadata, actors, parents, duplicates, provenance, related, specification, comments, files, links, subscription, github, admission] = await db.batch([
    ...issueDetailReadStatements(db, issue.id),
    ...discussionReadStatements(db, issue.id, operator.id),
    subscriptionStatement(db, issue.id, operator.id),
    githubIssueStatement(db, issue.id),
    // Keep admission last in the same transaction as all selected-detail reads.
    issueAccessStatement(db, identifier, operator.id),
  ])
  // The enclosing response additionally reauthorizes the native session and
  // captured workspace before releasing any bytes, including notification drain.
  try { issueAccessProjection(admission.results[0] as IssueAccessRow | undefined) }
  catch (error) {
    // Membership or issue removal during projection uses the real API denial
    // path, just like a selection not admitted by the captured graph.
    if (error instanceof IssueAccessError) return null
    throw error
  }
  const base = '/api/issues/' + encodeURIComponent(identifier)
  return {
    [base]: enrichIssueDetail(detail, [metadata, actors, parents, duplicates, provenance, related, specification]),
    [base + '/discussion']: discussionProjection([comments, files, links]),
    [base + '/subscription']: subscriptionFromRow(subscription.results[0] as SubscriptionRow),
    [base + '/github']: githubIssueFromRows(github.results),
  }
}
