import { returnDueIntake } from '../../src/core/features/intake-return/service'
import { testCookie } from './native-fixture'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import assert from 'node:assert/strict'
import { beforeAll, describe, inject, it } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import { insertSampleData } from '../../src/core/features/sample-data/repository'
import { ensureSampleData } from '../../src/core/features/sample-data/service'
import { buildVectorSample, vectorSampleIds } from '../../sample-data/vector'

const app = createServerApp()
const fixedNow = '2026-08-31T12:00:00.000Z'

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await ensureSampleData(env.DB, new Date(fixedNow))
})

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const operatorId = headers.get('x-vector-operator-id') ?? vectorSampleIds.sarah
  headers.delete('x-vector-operator-id')
  headers.set('cookie', await testCookie(env.DB, operatorId))
  headers.set('origin', 'https://vector.test')
  return app.request(`https://vector.test${path}`, { ...init, headers }, { ...env, APP_ORIGIN: 'https://vector.test' })
}

function post(path: string, body: unknown, operatorId = vectorSampleIds.sarah) {
  return request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-vector-operator-id': operatorId,
    },
    body: JSON.stringify(body),
  })
}

describe('issue mutations on D1', () => {
  it('persists a fully contextual issue and allocates stable team identifiers', async () => {
    const input = {
      title: 'Verify durable issue creation',
      description: 'This issue is created through the real Hono route.',
      teamId: vectorSampleIds.flow,
      statusId: vectorSampleIds.flowUnstarted,
      assigneeOperatorId: vectorSampleIds.maya,
      projectId: vectorSampleIds.reliability,
      cycleId: vectorSampleIds.flowCycle,
      priority: 'high',
      labelIds: [
        vectorSampleIds.customerLabel,
        vectorSampleIds.reliabilityLabel,
      ],
      estimate: 13,
      dueDate: '2026-09-02',
      expectedOutcome: 'Creation has every selected context field.',
      customerImpact: 'Operators can capture the complete request once.',
      customFields: {
        requestSource: 'operator',
        severityNote: 'review after launch',
      },
    }
    const first = await post('/api/issues', input)
    assert.equal(first.status, 201)
    const created = (await first.json()) as {
      identifier: string
      description: string
      status: { id: string }
      assignee: { id: string } | null
      project: { id: string } | null
      cycle: { id: string } | null
      labels: Array<{ id: string }>
      estimate: number | null
      dueDate: string | null
      expectedOutcome: string | null
      customerImpact: string | null
      customFields: unknown
      activity: Array<{ kind: string }>
    }
    assert.equal(created.identifier, 'FLW-843')
    assert.equal(created.description, input.description)
    assert.equal(created.status.id, vectorSampleIds.flowUnstarted)
    assert.equal(created.assignee?.id, vectorSampleIds.maya)
    assert.equal(created.project?.id, vectorSampleIds.reliability)
    assert.equal(created.cycle?.id, vectorSampleIds.flowCycle)
    assert.deepEqual(
      created.labels.map((label) => label.id).sort(),
      [...input.labelIds].sort(),
    )
    assert.equal(created.estimate, input.estimate)
    assert.equal(created.dueDate, input.dueDate)
    assert.equal(created.expectedOutcome, input.expectedOutcome)
    assert.equal(created.customerImpact, input.customerImpact)
    assert.deepEqual(created.customFields, input.customFields)
    assert.ok(
      created.activity.some((activity) => activity.kind === 'issue.created'),
    )

    const second = await post('/api/issues', {
      title: 'Follow-up',
      teamId: vectorSampleIds.flow,
    })
    assert.equal(second.status, 201)
    assert.equal(
      ((await second.json()) as { identifier: string }).identifier,
      'FLW-844',
    )
  })

  it('defers FLW-842 from Current, returns it when due, then accepts it into Now and My work', async () => {
    const initial = await request(`/api/current?at=${fixedNow}`)
    assert.ok(
      (
        (await initial.json()) as {
          sections: { 'needs-decision': Array<{ identifier: string }> }
        }
      ).sections['needs-decision'].some(
        (issue) => issue.identifier === 'FLW-842',
      ),
    )

    const returnAt = new Date(Date.now() + 120_000).toISOString()
    const detail = await request('/api/issues/FLW-842')
    const version = ((await detail.json()) as { version: number }).version
    const deferred = await post('/api/issues/FLW-842/defer', {
      expectedVersion: version,
      returnAt,
      reason: 'Wait for the next evidence window.',
    })
    assert.equal(deferred.status, 200)
    assert.equal(
      ((await deferred.json()) as { deferredUntil: string }).deferredUntil,
      returnAt,
    )

    const beforeReturn = await request(
      `/api/current?at=${new Date(Date.now() + 60_000).toISOString()}`,
    )
    assert.ok(
      !(
        (await beforeReturn.json()) as {
          sections: { 'needs-decision': Array<{ identifier: string }> }
        }
      ).sections['needs-decision'].some(
        (issue) => issue.identifier === 'FLW-842',
      ),
    )
    await returnDueIntake({DB:env.DB},new Date(Date.now()+180_000))
    const afterReturn = await request(
      `/api/current?at=${new Date(Date.now() + 180_000).toISOString()}`,
    )
    assert.ok(
      (
        (await afterReturn.json()) as {
          sections: { 'needs-decision': Array<{ identifier: string }> }
        }
      ).sections['needs-decision'].some(
        (issue) => issue.identifier === 'FLW-842',
      ),
    )

    const deferredDetail = await request('/api/issues/FLW-842')
    const deferredVersion = (
      (await deferredDetail.json()) as { version: number }
    ).version
    const accepted = await post('/api/issues/FLW-842/accept', {
      expectedVersion: deferredVersion,
      reason: 'Start the customer-impacting repair.',
      assigneeOperatorId: vectorSampleIds.maya,
      priority: 'high',
      cycleId: vectorSampleIds.flowCycle,
      statusId: vectorSampleIds.flowStarted,
    })
    assert.equal(accepted.status, 200)
    const acceptedBody = (await accepted.json()) as {
      version: number
      deferredUntil: string | null
      status: { category: string }
      assignee: { id: string } | null
      decisions: Array<{ kind: string }>
    }
    assert.equal(acceptedBody.deferredUntil, null)
    assert.equal(acceptedBody.status.category, 'started')
    assert.equal(acceptedBody.assignee?.id, vectorSampleIds.maya)
    assert.ok(
      acceptedBody.decisions.some((decision) => decision.kind === 'accepted'),
    )

    const current = await request(`/api/current?at=${new Date().toISOString()}`)
    const currentSections = (
      (await current.json()) as {
        sections: {
          now: Array<{ identifier: string }>
          'needs-decision': Array<{ identifier: string }>
        }
      }
    ).sections
    assert.ok(
      currentSections.now.some((issue) => issue.identifier === 'FLW-842'),
    )
    assert.ok(
      !currentSections['needs-decision'].some(
        (issue) => issue.identifier === 'FLW-842',
      ),
    )
    const myWork = await request(
      `/api/my-work?at=${new Date().toISOString()}`,
      { headers: { 'x-vector-operator-id': vectorSampleIds.maya } },
    )
    assert.ok(
      (
        (await myWork.json()) as {
          sections: { now: Array<{ identifier: string }> }
        }
      ).sections.now.some((issue) => issue.identifier === 'FLW-842'),
    )

    const stale = await post('/api/issues/FLW-842/accept', {
      expectedVersion: deferredVersion,
    })
    assert.equal(stale.status, 409)
    const staleBody = (await stale.json()) as {
      error: string
      version: number
      issue: { version: number; identifier: string }
    }
    assert.equal(staleBody.error, 'stale_version')
    assert.equal(staleBody.issue.identifier, 'FLW-842')
    assert.equal(staleBody.version, acceptedBody.version)
  })

  it('declines an intake issue into the default Canceled status without erasing its decision history', async () => {
    const sample = buildVectorSample(new Date(fixedNow))
    const declinedIssue = {
      ...sample.issues[0],
      id: '01J00000000000000000000900',
      identifier: 'FLW-900',
      sequenceNumber: 900,
      title: 'Decline this evidence-backed intake',
      version: 1,
      deferredUntil: null,
    }
    await insertSampleData(env.DB, { ...sample, issues: [declinedIssue] })

    const declined = await post('/api/issues/FLW-900/decline', {
      expectedVersion: 1,
      reason: 'This is already covered by the current repair.',
    })
    assert.equal(declined.status, 200)
    const body = (await declined.json()) as {
      status: { id: string; category: string }
      canceledAt: string | null
      decisions: Array<{ kind: string; reason: string | null }>
      activity: Array<{ kind: string }>
    }
    assert.equal(body.status.id, vectorSampleIds.flowCanceled)
    assert.equal(body.status.category, 'canceled')
    assert.ok(body.canceledAt)
    assert.ok(
      body.decisions.some(
        (decision) =>
          decision.kind === 'declined' &&
          decision.reason === 'This is already covered by the current repair.',
      ),
    )
    assert.ok(
      body.activity.some((activity) => activity.kind === 'intake.declined'),
    )
  })

  it('rejects malformed and semantically invalid mutation requests', async () => {
    const missingTitle = await post('/api/issues', {
      teamId: vectorSampleIds.flow,
    })
    assert.equal(missingTitle.status, 400)
    const intakeStatus = await post('/api/issues', {
      title: 'Invalid intake status',
      teamId: vectorSampleIds.flow,
      statusId: vectorSampleIds.flowIntake,
    })
    assert.equal(intakeStatus.status, 400)
    const malformedDefer = await post('/api/issues/FLW-842/defer', {
      expectedVersion: 3,
      returnAt: 'tomorrow',
    })
    assert.equal(malformedDefer.status, 400)
    const missingDeclineReason = await post('/api/issues/FLW-900/decline', {
      expectedVersion: 2,
      reason: '',
    })
    assert.equal(missingDeclineReason.status, 400)

    const sample = buildVectorSample(new Date(fixedNow))
    await insertSampleData(env.DB, {
      ...sample,
      teams: [
        {
          ...sample.teams[0],
          id: '01J00000000000000000000901',
          name: 'Archived team',
          identifierPrefix: 'ARC',
          archivedAt: fixedNow,
        },
      ],
      projects: [
        {
          ...sample.projects[0],
          id: '01J00000000000000000000902',
          name: 'Archived project',
          archivedAt: fixedNow,
        },
      ],
    })
    const archivedTeam = await post('/api/issues', {
      title: 'Invalid archived team',
      teamId: '01J00000000000000000000901',
    })
    assert.equal(archivedTeam.status, 400)
    const archivedProject = await post('/api/issues', {
      title: 'Invalid archived project',
      teamId: vectorSampleIds.flow,
      projectId: '01J00000000000000000000902',
    })
    assert.equal(archivedProject.status, 400)
  })
})
