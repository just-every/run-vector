import { commitWithAssignee } from "./assignment-commit";
import { mutationDatabase } from "../auth/mutation-database";
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { createUlid } from '../../shared/ids'
import {
  cycles,
  intakeDecisions,
  issueActivity,
  issueLabels,
  issues,
  labels,
  operators,
  projects,
  teamIssueSequences,
  teams,
  workflowStatuses,
} from '../../platform/db/schema'
import { IssueMutationError } from './errors'
import type { AcceptIssueInput, CreateIssueInput, DeclineIssueInput, DeferIssueInput } from './input'

type Database = ReturnType<typeof drizzle>
type WriteOutcome = { outcome: 'written'; identifier: string } | { outcome: 'stale'; identifier: string }
type DecisionState = {
  issueValues: Record<string, string | number | null>
  reason: string | null
  returnAt: string | null
  previousValue: unknown
  nextValue: unknown
}

type CreateIssueRecordInput = {
  actorOperatorId: string
  input: CreateIssueInput
  now: Date
}

type IntakeDecisionRecordInput = {
  actorOperatorId: string
  expectedVersion: number
  identifier: string
  input: AcceptIssueInput | DeclineIssueInput | DeferIssueInput
  kind: 'accepted' | 'deferred' | 'declined'
  now: Date
}

export async function createIssueRecord(binding: D1Database, request: CreateIssueRecordInput): Promise<{ identifier: string }> {
  binding = mutationDatabase(binding, request.actorOperatorId)
  const db = drizzle(binding)
  const now = request.now.toISOString()
  const team = await requireActiveTeam(db, request.input.teamId)
  const status = request.input.statusId
    ? await requireStatus(db, request.input.statusId, team.id)
    : await defaultStatus(db, team.id, 'backlog')
  if (!['backlog', 'unstarted', 'started', 'completed', 'canceled'].includes(status.category)) {
    throw new IssueMutationError('invalid_option', 'New issues must use a non-Intake, non-Duplicate status.')
  }
  await validateIssueOptions(db, team.workspaceId, team.id, request.input)

  const sequenceNumber = await allocateSequence(db, team.id, now)
  const identifier = `${team.identifierPrefix}-${sequenceNumber}`
  const issueId = createUlid(request.now)
  const issueWrite = db.insert(issues).values({
    id: issueId,
    identifier,
    originPrefix: team.identifierPrefix,
    sequenceNumber,
    teamId: team.id,
    title: request.input.title,
    description: request.input.description,
    statusId: status.id,
    priority: request.input.priority,
    assigneeOperatorId: request.input.assigneeOperatorId,
    projectId: request.input.projectId,
    cycleId: request.input.cycleId,
    dueDate: request.input.dueDate,
    estimate: request.input.estimate,
    expectedOutcome: request.input.expectedOutcome,
    customerImpact: request.input.customerImpact,
    customFieldsJson: JSON.stringify(request.input.customFields),
    deferredUntil: null,
    version: 1,
    completedAt: status.category === 'completed' ? now : null,
    canceledAt: status.category === 'canceled' ? now : null,
    createdAt: now,
    updatedAt: now,
  })
  const activityWrite = db.insert(issueActivity).values(activityRow({
    issueId,
    actorOperatorId: request.actorOperatorId,
    kind: 'issue.created',
    previousValue: null,
    nextValue: {
      identifier,
      title: request.input.title,
      description: request.input.description,
      teamId: team.id,
      statusId: status.id,
      assigneeOperatorId: request.input.assigneeOperatorId,
      projectId: request.input.projectId,
      cycleId: request.input.cycleId,
      priority: request.input.priority,
      labelIds: request.input.labelIds,
      estimate: request.input.estimate,
      dueDate: request.input.dueDate,
      expectedOutcome: request.input.expectedOutcome,
      customerImpact: request.input.customerImpact,
      customFields: request.input.customFields,
    },
    now,
  }))
  const labelWrites = request.input.labelIds.length === 0
    ? []
    : [db.insert(issueLabels).values(request.input.labelIds.map((labelId) => ({ issueId, labelId, createdAt: now })))]
  await commitWithAssignee(binding, request.input.assigneeOperatorId, team.workspaceId,
    [issueWrite, ...labelWrites, activityWrite].map(query => {
      const { sql, params } = query.toSQL()
      return binding.prepare(sql).bind(...params)
    }))
  return { identifier }
}

export async function writeIntakeDecision(binding: D1Database, request: IntakeDecisionRecordInput): Promise<WriteOutcome> {
  binding = mutationDatabase(binding, request.actorOperatorId)
  const db = drizzle(binding)
  const now = request.now.toISOString()
  const issue = await requireIssue(db, request.identifier)
  if (issue.version !== request.expectedVersion) return { outcome: 'stale', identifier: issue.identifier }

  const team = await requireActiveTeam(db, issue.teamId)
  const currentStatus = await requireStatus(db, issue.statusId, team.id)
  if (currentStatus.category !== 'intake') {
    throw new IssueMutationError('invalid_transition', `Issue ${issue.identifier} is not awaiting an intake decision.`)
  }

  const next = await nextDecisionState(db, team, issue, request)
  const decisionWrite = db.insert(intakeDecisions).select(decisionSelection(db, issue.identifier, request, next, now))
  const activityWrite = db.insert(issueActivity).select(activitySelection(db, issue.identifier, request, next, now))
  const issueWrite = db.update(issues).set({ ...next.issueValues, version: issue.version + 1, updatedAt: now })
    .where(and(eq(issues.identifier, issue.identifier), eq(issues.version, request.expectedVersion)))
  const writes = await commitWithAssignee(binding, request.kind === 'accepted' ? (request.input as AcceptIssueInput).assigneeOperatorId : null, team.workspaceId,
    [decisionWrite, activityWrite, issueWrite].map(query => {
      const { sql, params } = query.toSQL()
      return binding.prepare(sql).bind(...params)
    }))
  return writes[2].meta.changes === 1
    ? { outcome: 'written', identifier: issue.identifier }
    : { outcome: 'stale', identifier: issue.identifier }
}

function decisionSelection(db: Database, identifier: string, request: IntakeDecisionRecordInput, next: DecisionState, now: string) {
  return db.select({
    id: sql<string>`${createUlid(request.now)}`.as('id'),
    issueId: issues.id,
    actorOperatorId: sql<string>`${request.actorOperatorId}`.as('actor_operator_id'),
    kind: sql<string>`${request.kind}`.as('kind'),
    reason: sql<string | null>`${next.reason}`.as('reason'),
    returnAt: sql<string | null>`${next.returnAt}`.as('return_at'),
    createdAt: sql<string>`${now}`.as('created_at'),
    updatedAt: sql<string>`${now}`.as('updated_at'),
  }).from(issues).where(and(eq(issues.identifier, identifier), eq(issues.version, request.expectedVersion)))
}

function activitySelection(db: Database, identifier: string, request: IntakeDecisionRecordInput, next: DecisionState, now: string) {
  const activity = activityRow({
    issueId: '',
    actorOperatorId: request.actorOperatorId,
    kind: `intake.${request.kind}`,
    previousValue: next.previousValue,
    nextValue: next.nextValue,
    now,
  })
  return db.select({
    id: sql<string>`${activity.id}`.as('id'),
    issueId: issues.id,
    actorOperatorId: sql<string>`${activity.actorOperatorId}`.as('actor_operator_id'),
    kind: sql<string>`${activity.kind}`.as('kind'),
    previousValueJson: sql<string | null>`${activity.previousValueJson}`.as('previous_value_json'),
    nextValueJson: sql<string | null>`${activity.nextValueJson}`.as('next_value_json'),
    createdAt: sql<string>`${now}`.as('created_at'),
    updatedAt: sql<string>`${now}`.as('updated_at'),
  }).from(issues).where(and(eq(issues.identifier, identifier), eq(issues.version, request.expectedVersion)))
}

async function nextDecisionState(
  db: Database,
  team: typeof teams.$inferSelect,
  issue: typeof issues.$inferSelect,
  request: IntakeDecisionRecordInput,
): Promise<DecisionState> {
  if (request.kind === 'accepted') {
    const input = request.input as AcceptIssueInput
    const status = input.statusId
      ? await requireStatus(db, input.statusId, team.id)
      : await defaultStatus(db, team.id, 'unstarted')
    if (!['started', 'unstarted'].includes(status.category)) {
      throw new IssueMutationError('invalid_option', 'Accepted intake must move to a Started or Unstarted status.')
    }
    await Promise.all([validateAssignee(db, input.assigneeOperatorId), validateCycle(db, input.cycleId, team.id)])
    return {
      issueValues: { statusId: status.id, assigneeOperatorId: input.assigneeOperatorId, priority: input.priority, cycleId: input.cycleId, deferredUntil: null, completedAt: null, canceledAt: null },
      reason: input.reason,
      returnAt: null,
      previousValue: decisionState(issue),
      nextValue: { statusId: status.id, assigneeOperatorId: input.assigneeOperatorId, priority: input.priority, cycleId: input.cycleId, deferredUntil: null },
    }
  }

  if (request.kind === 'deferred') {
    const input = request.input as DeferIssueInput
    if (new Date(input.returnAt) <= request.now) {
      throw new IssueMutationError('invalid_option', 'A deferral return time must be in the future.')
    }
    return {
      issueValues: { deferredUntil: input.returnAt },
      reason: input.reason,
      returnAt: input.returnAt,
      previousValue: { deferredUntil: issue.deferredUntil },
      nextValue: { deferredUntil: input.returnAt },
    }
  }

  const input = request.input as DeclineIssueInput
  const status = await defaultStatus(db, team.id, 'canceled')
  return {
    issueValues: { statusId: status.id, deferredUntil: null, canceledAt: request.now.toISOString(), completedAt: null },
    reason: input.reason,
    returnAt: null,
    previousValue: decisionState(issue),
    nextValue: { statusId: status.id, deferredUntil: null, canceledAt: request.now.toISOString() },
  }
}

function decisionState(issue: typeof issues.$inferSelect) {
  return {
    statusId: issue.statusId,
    assigneeOperatorId: issue.assigneeOperatorId,
    priority: issue.priority,
    cycleId: issue.cycleId,
    deferredUntil: issue.deferredUntil,
  }
}

export async function allocateSequence(db: Database, teamId: string, now: string): Promise<number> {
  const [allocation] = await db.insert(teamIssueSequences).values({ teamId, lastSequence: 1, updatedAt: now }).onConflictDoUpdate({
    target: teamIssueSequences.teamId,
    set: { lastSequence: sql`${teamIssueSequences.lastSequence} + 1`, updatedAt: now },
  }).returning({ lastSequence: teamIssueSequences.lastSequence })
  if (!allocation) throw new Error(`Could not allocate an issue sequence for team ${teamId}.`)
  return allocation.lastSequence
}

export async function requireActiveTeam(db: Database, teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) throw new IssueMutationError('invalid_option', `Team ${teamId} does not exist.`)
  if (team.archivedAt !== null) throw new IssueMutationError('invalid_option', `Team ${team.name} is archived.`)
  return team
}

export async function requireIssue(db: Database, identifier: string) {
  const [issue] = await db.select().from(issues).where(eq(issues.identifier, identifier)).limit(1)
  if (!issue) throw new IssueMutationError('issue_not_found', `Issue ${identifier} does not exist.`)
  return issue
}

export async function requireStatus(db: Database, statusId: string, teamId: string) {
  const [status] = await db.select().from(workflowStatuses).where(and(eq(workflowStatuses.id, statusId), eq(workflowStatuses.teamId, teamId))).limit(1)
  if (!status) throw new IssueMutationError('invalid_option', `Workflow status ${statusId} does not belong to this team.`)
  return status
}

export async function defaultStatus(db: Database, teamId: string, category: string) {
  const [status] = await db.select().from(workflowStatuses).where(and(eq(workflowStatuses.teamId, teamId), eq(workflowStatuses.category, category))).orderBy(asc(workflowStatuses.position)).limit(1)
  if (!status) throw new Error(`Team ${teamId} has no ${category} workflow status.`)
  return status
}

async function validateIssueOptions(db: Database, workspaceId: string, teamId: string, input: CreateIssueInput) {
  await Promise.all([
    validateAssignee(db, input.assigneeOperatorId),
    validateProject(db, input.projectId, workspaceId),
    validateCycle(db, input.cycleId, teamId),
    validateLabels(db, input.labelIds, workspaceId),
  ])
}

export async function validateAssignee(db: Database, operatorId: string | null) {
  if (operatorId === null) return
  const [operator] = await db.select().from(operators).where(eq(operators.id, operatorId)).limit(1)
  if (!operator || operator.removedAt !== null) throw new IssueMutationError('invalid_option', `Assignee ${operatorId} is unavailable.`)
}

export async function validateProject(db: Database, projectId: string | null, workspaceId: string) {
  if (projectId === null) return
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!project || project.workspaceId !== workspaceId || project.archivedAt !== null) {
    throw new IssueMutationError('invalid_option', `Project ${projectId} is unavailable.`)
  }
}

export async function validateCycle(db: Database, cycleId: string | null, teamId: string) {
  if (cycleId === null) return
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1)
  if (!cycle || cycle.teamId !== teamId || cycle.closedAt !== null) {
    throw new IssueMutationError('invalid_option', `Cycle ${cycleId} is unavailable for this team.`)
  }
}

export async function validateLabels(db: Database, labelIds: string[], workspaceId: string) {
  if (labelIds.length === 0) return
  const found = await db.select({ id: labels.id, workspaceId: labels.workspaceId }).from(labels).where(inArray(labels.id, labelIds))
  if (found.length !== labelIds.length || found.some((label) => label.workspaceId !== workspaceId)) {
    throw new IssueMutationError('invalid_option', 'Every label must exist in this workspace.')
  }
}

export function activityRow(entry: {
  issueId: string
  actorOperatorId: string
  kind: string
  previousValue: unknown
  nextValue: unknown
  now: string
}) {
  return {
    id: createUlid(new Date(entry.now)),
    issueId: entry.issueId,
    actorOperatorId: entry.actorOperatorId,
    kind: entry.kind,
    previousValueJson: entry.previousValue === null ? null : JSON.stringify(entry.previousValue),
    nextValueJson: entry.nextValue === null ? null : JSON.stringify(entry.nextValue),
    createdAt: entry.now,
    updatedAt: entry.now,
  }
}
