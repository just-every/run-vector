import { testCookie } from './native-fixture'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import assert from 'node:assert/strict'
import { beforeAll, describe, inject, it } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import { vectorSampleIds } from '../../sample-data/vector'
import { ensureSampleData } from '../../src/core/features/sample-data/service'

const now = new Date('2026-08-31T12:00:00.000Z')
const app = createServerApp()

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await ensureSampleData(env.DB, now)
})

async function request(path: string) {
  return app.request(`https://vector.test${path}`, { headers: { cookie: await testCookie(env.DB, vectorSampleIds.sarah) } }, { ...env, APP_ORIGIN: 'https://vector.test' })
}

describe('the D1 data spine', () => {
  it('reports health only after the required D1 binding is reachable', async () => {
    const response = await request('/health')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  })

  it('seeds validated sample data and projects Current with disjoint precedence', async () => {
    const response = await request('/api/current?at=2026-08-31T12:00:00.000Z')
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      sections: Record<
        string,
        Array<{ identifier: string; primaryReason: string }>
      >
    }
    assert.deepEqual(
      body.sections['needs-decision'].map((issue) => issue.identifier),
      ['FLW-842'],
    )
    assert.equal(
      body.sections['needs-decision'][0]?.primaryReason,
      'awaiting-decision',
    )
    assert.ok(body.sections.now.some((issue) => issue.identifier === 'FLW-840'))
    assert.ok(
      body.sections.next.some((issue) => issue.identifier === 'PLT-101'),
    )
    assert.ok(
      body.sections['recently-done'].some(
        (issue) => issue.identifier === 'PLT-104',
      ),
    )
    const appearances = Object.values(body.sections)
      .flat()
      .filter((issue) => issue.identifier === 'FLW-842')
    assert.equal(appearances.length, 1)
  })

  it('builds the signed-in operator queue with waiting-before-now-before-next precedence', async () => {
    const response = await request('/api/my-work?at=2026-08-31T12:00:00.000Z')
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      sections: Record<string, Array<{ identifier: string }>>
    }
    assert.deepEqual(
      body.sections.waiting.map((issue) => issue.identifier),
      ['PLT-102'],
    )
    assert.ok(body.sections.now.some((issue) => issue.identifier === 'PLT-103'))
    assert.ok(
      body.sections.next.some((issue) => issue.identifier === 'PLT-101'),
    )
  })

  it('returns FLW-842 with source assertions and the policy recommendation intact', async () => {
    const response = await request(
      '/api/issues/FLW-842?at=2026-08-31T12:00:00.000Z',
    )
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      evidence: Array<{
        measurements: { failureRate: string; customersAffected: number }
        assertions: {
          recommendation: {
            assigneeOperatorId: string
            priority: string
            statusCategory: string
          }
        }
      }>
    }
    assert.equal(body.evidence[0]?.measurements.failureRate, '8.7%')
    assert.equal(body.evidence[0]?.measurements.customersAffected, 23)
    assert.deepEqual(body.evidence[0]?.assertions.recommendation, {
      source: 'policy',
      assigneeOperatorId: vectorSampleIds.maya,
      priority: 'high',
      statusCategory: 'started',
      team: 'Reliability',
      onCall: true,
    })
  })

  it('reports the project health vocabulary with concrete risk evidence', async () => {
    const response = await request('/api/projects?at=2026-08-31T12:00:00.000Z')
    assert.equal(response.status, 200)
    const body = (await response.json()) as {
      projects: Array<{
        name: string
        health: string
        risks: Array<{ kind: string; issueIdentifiers?: string[] }>
      }>
    }
    const byName = new Map(
      body.projects.map((project) => [project.name, project]),
    )
    assert.equal(byName.get('Customer Reliability')?.health, 'at-risk')
    assert.deepEqual(
      byName.get('Customer Reliability')?.risks[0]?.issueIdentifiers,
      ['FLW-841'],
    )
    assert.equal(byName.get('Platform Hardening')?.health, 'on-track')
    assert.equal(byName.get('Discovery Notes')?.health, 'unknown')
    assert.equal(byName.get('Legacy Migration')?.health, 'none')
  })

  it('searches durable records and serves parameterized project and option endpoints', async () => {
    const search = await request('/api/search?q=FLW-842')
    assert.equal(search.status, 200)
    const searchBody = (await search.json()) as {
      issues: Array<{ identifier: string }>
    }
    assert.equal(searchBody.issues[0]?.identifier, 'FLW-842')

    const project = await request(
      `/api/projects/${vectorSampleIds.reliability}?at=2026-08-31T12:00:00.000Z`,
    )
    assert.equal(project.status, 200)
    const projectBody = (await project.json()) as {
      name: string
      teams: Array<{ name: string }>
      cycles: Array<{
        name: string
        capacity: number | null
        remainingEstimatedPoints: number
        unestimatedIssueCount: number
      }>
      issues: Array<{ identifier: string; team: { name: string } }>
      dependencies: unknown[]
    }
    assert.equal(projectBody.name, 'Customer Reliability')
    assert.deepEqual(
      projectBody.teams.map((team) => team.name),
      ['Flow'],
    )
    assert.deepEqual(
      projectBody.issues.map((issue) => issue.identifier),
      ['FLW-840', 'FLW-841', 'FLW-842'],
    )
    assert.equal(projectBody.issues[0]?.team.name, 'Flow')
    assert.deepEqual(
      projectBody.cycles.map((cycle) => ({
        name: cycle.name,
        capacity: cycle.capacity,
        remainingEstimatedPoints: cycle.remainingEstimatedPoints,
        unestimatedIssueCount: cycle.unestimatedIssueCount,
      })),
      [
        {
          name: 'Reliability response',
          capacity: 18,
          remainingEstimatedPoints: 13,
          unestimatedIssueCount: 0,
        },
      ],
    )
    assert.equal(projectBody.dependencies.length, 0)

    const options = await request('/api/options')
    assert.equal(options.status, 200)
    const optionBody = (await options.json()) as {
      workspace: { id: string }
      operator: { id: string }
      teams: unknown[]
      statuses: Array<{ teamId: string; category: string }>
      cycles: Array<{ teamId: string }>
    }
    assert.equal(optionBody.workspace.id, vectorSampleIds.workspace)
    assert.equal(optionBody.operator.id, vectorSampleIds.sarah)
    assert.ok(optionBody.teams.length > 0)
    assert.ok(
      optionBody.statuses.some(
        (status) =>
          status.teamId === vectorSampleIds.flow &&
          status.category === 'started',
      ),
    )
    assert.ok(
      optionBody.cycles.some((cycle) => cycle.teamId === vectorSampleIds.flow),
    )
  })
})
