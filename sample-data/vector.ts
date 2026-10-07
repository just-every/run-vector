type OffsetDate = { days?: number; minutes?: number }

const id = {
  workspace: '01J00000000000000000000001',
  sarah: '01J00000000000000000000002',
  maya: '01J00000000000000000000003',
  alex: '01J00000000000000000000004',
  flow: '01J00000000000000000000010',
  platform: '01J00000000000000000000011',
  flowIntake: '01J00000000000000000000020',
  flowBacklog: '01J00000000000000000000021',
  flowUnstarted: '01J00000000000000000000022',
  flowStarted: '01J00000000000000000000023',
  flowCompleted: '01J00000000000000000000024',
  flowCanceled: '01J00000000000000000000025',
  flowDuplicate: '01J00000000000000000000026',
  platformIntake: '01J00000000000000000000030',
  platformBacklog: '01J00000000000000000000031',
  platformUnstarted: '01J00000000000000000000032',
  platformStarted: '01J00000000000000000000033',
  platformCompleted: '01J00000000000000000000034',
  platformCanceled: '01J00000000000000000000035',
  platformDuplicate: '01J00000000000000000000036',
  reliability: '01J00000000000000000000040',
  hardening: '01J00000000000000000000041',
  discovery: '01J00000000000000000000042',
  legacy: '01J00000000000000000000043',
  flowCycle: '01J00000000000000000000050',
  platformCycle: '01J00000000000000000000051',
  platformNextCycle: '01J00000000000000000000052',
  customerLabel: '01J00000000000000000000060',
  reliabilityLabel: '01J00000000000000000000061',
  flw842: '01J00000000000000000000100',
  flw841: '01J00000000000000000000101',
  flw840: '01J00000000000000000000102',
  plt101: '01J00000000000000000000103',
  plt102: '01J00000000000000000000104',
  plt103: '01J00000000000000000000105',
  plt104: '01J00000000000000000000106',
  plt105: '01J00000000000000000000107',
  evidence: '01J00000000000000000000120',
  decision: '01J00000000000000000000121',
  activity: '01J00000000000000000000130',
  savedView: '01J00000000000000000000140',
  preference: '01J00000000000000000000141',
  session: '01J00000000000000000000150',
} as const

function shift(now: Date, offset: OffsetDate = {}): string {
  const amount = (offset.days ?? 0) * 86_400_000 + (offset.minutes ?? 0) * 60_000
  return new Date(now.getTime() + amount).toISOString()
}

function workspaceDate(now: Date, days: number): string {
  const shifted = new Date(now.getTime() + days * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted)
}

function timestamps(now: Date, offset: OffsetDate = {}) {
  const value = shift(now, offset)
  return { createdAt: value, updatedAt: value }
}

export function buildVectorSample(now: Date) {
  const flowStatuses = [
    ['Intake', 'intake', id.flowIntake],
    ['Backlog', 'backlog', id.flowBacklog],
    ['Todo', 'unstarted', id.flowUnstarted],
    ['In progress', 'started', id.flowStarted],
    ['Done', 'completed', id.flowCompleted],
    ['Canceled', 'canceled', id.flowCanceled],
    ['Duplicate', 'duplicate', id.flowDuplicate],
  ] as const
  const platformStatuses = [
    ['Intake', 'intake', id.platformIntake],
    ['Backlog', 'backlog', id.platformBacklog],
    ['Todo', 'unstarted', id.platformUnstarted],
    ['In progress', 'started', id.platformStarted],
    ['Done', 'completed', id.platformCompleted],
    ['Canceled', 'canceled', id.platformCanceled],
    ['Duplicate', 'duplicate', id.platformDuplicate],
  ] as const

  return {
    workspace: {
      id: id.workspace,
      name: 'Vector',
      timezone: 'Australia/Brisbane',
      ...timestamps(now, { days: -30 }),
    },
    operators: [
      { id: id.sarah, name: 'Sarah Chen', email: 'sarah@vector.test', workspaceId: id.workspace, removedAt: null, ...timestamps(now, { days: -30 }) },
      { id: id.maya, name: 'Maya Ortiz', email: 'maya@vector.test', workspaceId: id.workspace, removedAt: null, ...timestamps(now, { days: -28 }) },
      { id: id.alex, name: 'Alex Lee', email: 'alex@vector.test', workspaceId: id.workspace, removedAt: null, ...timestamps(now, { days: -25 }) },
    ],
    sessions: [{
      id: id.session,
      operatorId: id.sarah,
      tokenHash: 'local-sarah-session',
      expiresAt: shift(now, { days: 30 }),
      revokedAt: null,
      ...timestamps(now),
    }],
    teams: [
      { id: id.flow, workspaceId: id.workspace, name: 'Flow', identifierPrefix: 'FLW', archivedAt: null, ...timestamps(now, { days: -30 }) },
      { id: id.platform, workspaceId: id.workspace, name: 'Platform', identifierPrefix: 'PLT', archivedAt: null, ...timestamps(now, { days: -30 }) },
    ],
    workflowStatuses: [...flowStatuses.map(([name, category, statusId], position) => ({
      id: statusId, teamId: id.flow, name, category, position, ...timestamps(now, { days: -30 }),
    })), ...platformStatuses.map(([name, category, statusId], position) => ({
      id: statusId, teamId: id.platform, name, category, position, ...timestamps(now, { days: -30 }),
    }))],
    projects: [
      { id: id.reliability, workspaceId: id.workspace, name: 'Customer Reliability', description: 'Protect reliable webhook delivery for customers.', leadOperatorId: id.alex, targetDate: workspaceDate(now, 14), lifecycle: 'active', color: '#f59e0b', icon: 'shield', archivedAt: null, ...timestamps(now, { days: -12 }) },
      { id: id.hardening, workspaceId: id.workspace, name: 'Platform Hardening', description: 'Improve platform delivery confidence.', leadOperatorId: id.sarah, targetDate: workspaceDate(now, 21), lifecycle: 'active', color: '#60a5fa', icon: 'wrench', archivedAt: null, ...timestamps(now, { days: -10 }) },
      { id: id.discovery, workspaceId: id.workspace, name: 'Discovery Notes', description: 'Explore future platform work.', leadOperatorId: id.maya, targetDate: null, lifecycle: 'active', color: '#a78bfa', icon: 'compass', archivedAt: null, ...timestamps(now, { days: -8 }) },
      { id: id.legacy, workspaceId: id.workspace, name: 'Legacy Migration', description: 'Archived historical migration work.', leadOperatorId: id.alex, targetDate: workspaceDate(now, -30), lifecycle: 'completed', color: null, icon: null, archivedAt: null, ...timestamps(now, { days: -60 }) },
    ],
    cycles: [
      { id: id.flowCycle, teamId: id.flow, name: 'Reliability response', startsAt: shift(now, { days: -3 }), endsAt: shift(now, { days: 4 }), capacity: 18, closedAt: null, ...timestamps(now, { days: -3 }) },
      { id: id.platformCycle, teamId: id.platform, name: 'Platform week 1', startsAt: shift(now, { days: -2 }), endsAt: shift(now, { days: 5 }), capacity: 20, closedAt: null, ...timestamps(now, { days: -2 }) },
      { id: id.platformNextCycle, teamId: id.platform, name: 'Platform week 2', startsAt: shift(now, { days: 5 }), endsAt: shift(now, { days: 12 }), capacity: 20, closedAt: null, ...timestamps(now, { days: -2 }) },
    ],
    labels: [
      { id: id.customerLabel, workspaceId: id.workspace, name: 'Customer escalation', color: '#f97316', ...timestamps(now, { days: -20 }) },
      { id: id.reliabilityLabel, workspaceId: id.workspace, name: 'Reliability', color: '#38bdf8', ...timestamps(now, { days: -20 }) },
    ],
    issues: [
      {
        id: id.flw842, identifier: 'FLW-842', originPrefix: 'FLW', sequenceNumber: 842, teamId: id.flow,
        title: 'Webhook delivery retries exceed customer tolerance',
        description: 'Webhook delivery failures are sustained. Acme customers report delayed or missing events.',
        statusId: id.flowIntake, priority: 'none', assigneeOperatorId: null, projectId: id.reliability, cycleId: null,
        dueDate: null, estimate: null, expectedOutcome: 'Restore reliable webhook delivery before customer tolerance is exceeded.',
        customerImpact: '23 customers report delayed or missing events.', customFieldsJson: '{}', deferredUntil: null,
        version: 1, completedAt: null, canceledAt: null, ...timestamps(now, { minutes: -60 }),
      },
      {
        id: id.flw841, identifier: 'FLW-841', originPrefix: 'FLW', sequenceNumber: 841, teamId: id.flow,
        title: 'Define webhook delivery error budget', description: 'Set the reliability threshold for webhook delivery.',
        statusId: id.flowUnstarted, priority: 'urgent', assigneeOperatorId: null, projectId: id.reliability, cycleId: id.flowCycle,
        dueDate: workspaceDate(now, 2), estimate: 8, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 2, completedAt: null, canceledAt: null, ...timestamps(now, { days: -1 }),
      },
      {
        id: id.flw840, identifier: 'FLW-840', originPrefix: 'FLW', sequenceNumber: 840, teamId: id.flow,
        title: 'Audit webhook retry telemetry', description: 'Verify the retry signal and customer impact measurements.',
        statusId: id.flowStarted, priority: 'high', assigneeOperatorId: id.sarah, projectId: id.reliability, cycleId: id.flowCycle,
        dueDate: workspaceDate(now, -1), estimate: 5, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 3, completedAt: null, canceledAt: null, ...timestamps(now, { minutes: -45 }),
      },
      {
        id: id.plt101, identifier: 'PLT-101', originPrefix: 'PLT', sequenceNumber: 101, teamId: id.platform,
        title: 'Prepare retry contract', description: 'Agree the API contract for retry behavior.',
        statusId: id.platformUnstarted, priority: 'high', assigneeOperatorId: id.sarah, projectId: id.hardening, cycleId: id.platformCycle,
        dueDate: workspaceDate(now, 3), estimate: 5, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 2, completedAt: null, canceledAt: null, ...timestamps(now, { minutes: -30 }),
      },
      {
        id: id.plt102, identifier: 'PLT-102', originPrefix: 'PLT', sequenceNumber: 102, teamId: id.platform,
        title: 'Roll out retry dashboard', description: 'Publish the retry dashboard after the contract is ready.',
        statusId: id.platformUnstarted, priority: 'medium', assigneeOperatorId: id.sarah, projectId: id.hardening, cycleId: id.platformCycle,
        dueDate: workspaceDate(now, 4), estimate: 3, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 1, completedAt: null, canceledAt: null, ...timestamps(now, { minutes: -20 }),
      },
      {
        id: id.plt103, identifier: 'PLT-103', originPrefix: 'PLT', sequenceNumber: 103, teamId: id.platform,
        title: 'Implement retry contract', description: 'Implement the agreed retry contract.',
        statusId: id.platformStarted, priority: 'high', assigneeOperatorId: id.sarah, projectId: id.hardening, cycleId: id.platformCycle,
        dueDate: workspaceDate(now, 1), estimate: 5, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 4, completedAt: null, canceledAt: null, ...timestamps(now, { minutes: -15 }),
      },
      {
        id: id.plt104, identifier: 'PLT-104', originPrefix: 'PLT', sequenceNumber: 104, teamId: id.platform,
        title: 'Document data retention', description: 'Capture completed retention decisions.',
        statusId: id.platformCompleted, priority: 'low', assigneeOperatorId: id.alex, projectId: id.discovery, cycleId: null,
        dueDate: null, estimate: 2, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 3, completedAt: shift(now, { days: -2 }), canceledAt: null, ...timestamps(now, { days: -2 }),
      },
      {
        id: id.plt105, identifier: 'PLT-105', originPrefix: 'PLT', sequenceNumber: 105, teamId: id.platform,
        title: 'Map future reliability work', description: 'Clarify unknown future platform scope.',
        statusId: id.platformUnstarted, priority: 'none', assigneeOperatorId: null, projectId: id.discovery, cycleId: null,
        dueDate: null, estimate: null, expectedOutcome: null, customerImpact: null, customFieldsJson: '{}', deferredUntil: null,
        version: 1, completedAt: null, canceledAt: null, ...timestamps(now, { days: -1 }),
      },
    ],
    issueLabels: [
      { issueId: id.flw842, labelId: id.customerLabel, createdAt: shift(now, { minutes: -60 }) },
      { issueId: id.flw842, labelId: id.reliabilityLabel, createdAt: shift(now, { minutes: -60 }) },
    ],
    dependencies: [{ blockedIssueId: id.plt102, blockingIssueId: id.plt101, createdAt: shift(now, { days: -1 }) }],
    evidence: [{
      id: id.evidence, issueId: id.flw842, sourceName: 'Sentry + customer reports', observedAt: shift(now, { minutes: -60 }), receivedAt: shift(now, { minutes: -59 }),
      summary: 'Webhook delivery failures reached 8.7%; customers report delayed or missing events.',
      measurementsJson: JSON.stringify({ failureRate: '8.7%', failureRateChange: '+5.4pp', errors: 1247, errorsChange: 982, customersAffected: 23, customersAffectedChange: 17, topFailingHook: 'POST /v1/webhooks/invoice.updated' }),
      assertionsJson: JSON.stringify({ attention: { source: 'source', value: 'Sustained delivery failures' }, likelyCause: { source: 'source', value: 'Deploy c1b3d9f regressed payload validation, causing 5xx retries and a ~2-hour tolerance risk.' }, recommendation: { source: 'policy', assigneeOperatorId: id.maya, priority: 'high', statusCategory: 'started', team: 'Reliability', onCall: true } }),
      ...timestamps(now, { minutes: -59 }),
    }],
    decisions: [{
      id: id.decision, issueId: id.flw842, actorOperatorId: id.sarah, kind: 'deferred', reason: 'Evidence retained for the triage demonstration.', returnAt: shift(now, { minutes: -1 }), ...timestamps(now, { minutes: -120 }),
    }],
    activity: [{
      id: id.activity, issueId: id.flw842, actorOperatorId: null, kind: 'intake.created', previousValueJson: null,
      nextValueJson: JSON.stringify({ source: 'Sentry + customer reports' }), ...timestamps(now, { minutes: -60 }),
    }],
    savedViews: [{
      id: id.savedView, workspaceId: id.workspace, ownerOperatorId: id.sarah, name: 'Reliability: retry trends', surface: 'issues', isShared: true,
      filtersJson: JSON.stringify({ label: id.reliabilityLabel }), sort: 'priority', grouping: 'project', ...timestamps(now, { days: -2 }),
    }],
    listPreferences: [{
      id: id.preference, operatorId: id.sarah, surface: 'current', filtersJson: '{}', sort: 'priority', grouping: 'none', ...timestamps(now, { days: -1 }),
    }],
  }
}

export const vectorSampleIds = id
