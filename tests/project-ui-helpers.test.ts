import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeHealthLabel,
  defaultPortfolioFilters,
  filterProjects,
  portfolioMetrics,
  projectProgressLabel,
} from '../src/core/features/projects/ui/helpers.ts'
import type { ProjectSummaryData } from '../src/core/features/projects/ui/data.ts'

function project(
  overrides: Partial<ProjectSummaryData> = {},
): ProjectSummaryData {
  return {
    id: '01J00000000000000000000040',
    name: 'Customer Reliability',
    description: 'Protect delivery.',
    lifecycle: 'active',
    archived: false,
    targetDate: '2026-09-14',
    lead: { id: '01J00000000000000000000004', name: 'Alex Lee' },
    health: 'at-risk',
    progress: { completed: 1, total: 3, percentage: 33 },
    risks: [],
    ...overrides,
  }
}

test('portfolio filters and metrics use the same real project set', () => {
  const activeAtRisk = project()
  const activeBlocked = project({
    id: '01J00000000000000000000041',
    name: 'Platform Hardening',
    health: 'blocked',
  })
  const completed = project({
    id: '01J00000000000000000000042',
    name: 'Legacy Migration',
    lifecycle: 'completed',
    health: 'none',
  })
  const visible = filterProjects([activeAtRisk, activeBlocked, completed], {
    ...defaultPortfolioFilters,
    health: 'at-risk',
  })
  assert.deepEqual(
    visible.map((entry) => entry.name),
    ['Customer Reliability'],
  )
  assert.deepEqual(portfolioMetrics(visible), {
    total: 1,
    blocked: 0,
    atRisk: 1,
    onTrack: 0,
    unknown: 0,
  })
  assert.deepEqual(
    filterProjects([activeAtRisk, activeBlocked, completed], {
      lifecycle: 'completed',
      health: 'all',
    }).map((entry) => entry.name),
    ['Legacy Migration'],
  )
})

test('health and progress labels do not manufacture health for inactive projects', () => {
  assert.equal(activeHealthLabel('none'), null)
  assert.equal(activeHealthLabel('on-track'), 'On track')
  assert.equal(
    projectProgressLabel(
      project({ progress: { completed: 0, total: 0, percentage: null } }),
    ),
    'No countable issues',
  )
})
