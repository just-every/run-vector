import { env } from 'cloudflare:workers'
import { Buffer } from 'node:buffer'
import { expect } from 'vitest'
import { agentRequest, agentToolClient } from './agent-resource-journey'
import { origin } from './base-auth-fixture'
import { json, refused, type Severity } from './custom-fields-journey'
import { destination, finalBody, freshTarget, httpExport, stageArchive, targetCall } from './http-archive-fixture'
import { resetLimits, type roleWorkspace } from './role-fixture'

type Workspace = Awaited<ReturnType<typeof roleWorkspace>>
type Issue = { id: string; identifier: string; version: number }
const fieldsOf = async (db: D1Database, issueId: string) => JSON.parse(String(await db.prepare('SELECT custom_fields_json AS v FROM issues WHERE id=?').bind(issueId).first('v')))
const issueRows = async () => (await env.DB.batch(['issues', 'issue_activity', 'team_issue_sequences'].map(name => env.DB.prepare('SELECT * FROM ' + name + ' ORDER BY rowid')))).map(result => result.results)

/** Creation, template application, the offered agent tool, copies and imports all
 * pass through the same typed boundary or report what they cannot carry. */
export async function severityWriters(w: Workspace, severity: Severity, other: string, issue: Issue, legacy: Record<string, unknown>) {
  const { owner, member } = w.people, minor = severity.options[0]!.id
  const create = (send: typeof owner.call, teamId: string, value: unknown) =>
    send('/issues', 'POST', { title: 'synthetic-vector-severity-created', teamId, customFields: { [severity.id]: value } })
  await refused(() => create(owner.call, w.team.id, 2), 400, 'number at native creation')
  await refused(() => create(member.api, w.team.id, 2), 400, 'number at /api/v1 creation')
  await refused(() => create(owner.call, other, minor), 400, 'another team field at creation')
  const created = await json(create(member.api, w.team.id, minor), 201)
  expect(created.customFields).toEqual({ [severity.id]: minor })
  // An issue template applied with a typed value.
  const template = await json(owner.call('/issue-templates', 'POST', { name: 'synthetic-vector-severity-template', teamId: w.team.id, defaults: { priority: 'high' } }), 201)
  const apply = (value: unknown) => member.call('/issues', 'POST', { teamId: w.team.id, templateId: template.id, templateVersion: template.version,
    title: 'synthetic-vector-severity-template-issue', customFields: { [severity.id]: value } })
  await refused(() => apply(4), 400, 'number in template application')
  expect(await json(apply(minor), 201)).toMatchObject({ priority: 'high', customFields: { [severity.id]: minor } })
  // The offered agent tool edits through the member's native authority.
  await resetLimits()
  await json(agentRequest('/agents/api/policy', { method: 'PUT', headers: { Origin: origin, Cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: { schema: 'rer-agent-policy/1', catalogue: 'rer-agent-classes/1', reviewers: ['person:' + owner.id],
      rules: [{ id: 'standard', class: 'standard', do: 'autonomous' }, { id: 'rest', class: '*', do: 'blocked' }], spend: { none: true } } }) }))
  const grant = await json(member.call('/settings/integrations/tokens', 'POST', { name: 'synthetic-vector-severity-agent', scopes: ['issues:write'] }), 201)
  const tool = agentToolClient(grant.token)
  const edit = (value: unknown) => tool('vector.issue.concurrent_edits', { identifier: created.identifier, change: { expectedVersion: created.version, customFields: { [severity.id]: value } },
    expected_revision: created.version, idempotency_key: crypto.randomUUID() })
  const unchanged = await issueRows()
  expect(JSON.stringify((await edit(6)).body)).toContain('invalid_option')
  expect(await issueRows(), 'agent refusal wrote no issue change').toEqual(unchanged)
  const major = severity.options[1]!.id
  expect((await edit(major)).status).toBe(200)
  expect((await fieldsOf(env.DB, created.id))[severity.id]).toBe(major)
  expect(await env.DB.prepare("SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND kind='issue.updated' AND actor_operator_id=? AND agent_operation_id IS NOT NULL")
    .bind(created.id, member.id).first('n')).toBe(1)
  // Copies: the same team keeps identity; another team drops the value and reports it.
  await resetLimits()
  const source = await fieldsOf(env.DB, issue.id)
  const same = await json(owner.call('/issues/' + issue.identifier + '/copy', 'POST', { expectedVersion: issue.version }), 201)
  expect(same.issue.customFields).toEqual(source)
  expect(same.mappings[0].customFields).toContainEqual({ from: severity.id, to: severity.id })
  expect(same.droppedValues).toEqual([])
  const cross = await json(owner.call('/issues/' + issue.identifier + '/copy', 'POST', { expectedVersion: issue.version, teamId: other }), 201)
  expect(cross.issue.customFields).toEqual(legacy)
  expect(cross.mappings[0].customFields).toEqual(expect.arrayContaining([{ from: severity.id, to: null }, { from: 'department', to: 'department' }]))
  expect(cross.droppedValues).toEqual([{ identifier: issue.identifier, field: 'customFields.' + severity.id, value: source[severity.id], reason: expect.stringContaining('Severity') }])
  // Imports have no typed mapping yet: a Severity column is reported and nothing is set.
  const team = (await w.state()).teams.find(row => row.id === w.team.id)!
  const rows = [{ id: 'synthetic-vector-sev-1', title: 'synthetic-vector-severity-imported', team: team.name, status: team.statuses.find(row => row.category === 'backlog')!.name,
    priority: 'high', created: '2026-09-01T01:02:03.000Z', updated: '2026-09-02T04:05:06.000Z', severity: 'Critical' }]
  const input = { format: 'json', source: 'synthetic-vector-severity', name: 'issues.json', base64: Buffer.from(JSON.stringify(rows)).toString('base64'),
    mapping: { sourceId: 'id', title: 'title', team: 'team', status: 'status', priority: 'priority', createdAt: 'created', updatedAt: 'updated' } }
  const review = await json(owner.call('/data/import/preview', 'POST', input))
  expect(review.errors).toEqual([])
  expect(review.omissions).toContainEqual(expect.objectContaining({ field: 'severity', code: 'unmapped_column' }))
  let run = await json(owner.call('/data/import/apply', 'POST', { input: { ...input, effectiveAt: review.effectiveAt }, reviewedFingerprint: review.fingerprint, operationKey: 'review:' + review.fingerprint, acknowledgeOmissions: true }))
  for (let attempt = 0; !['completed', 'rolled_back', 'undone'].includes(run.state); attempt++) {
    expect(attempt).toBeLessThan(50)
    run = await json(owner.call('/data/import/runs/' + run.id + '/resume', 'POST', {}))
  }
  expect(run.state).toBe('completed')
  expect(JSON.parse(String(await env.DB.prepare("SELECT custom_fields_json AS v FROM issues WHERE title='synthetic-vector-severity-imported'").first('v')))).toEqual({})
  return created
}

/** Definitions, options and issue values survive a native archive round-trip unchanged. */
export async function severityArchive(w: Workspace, issueIds: string[]) {
  await resetLimits()
  const records = await httpExport(w.people.owner.call), cookie = await freshTarget()
  const job = await stageArchive(records, cookie)
  const finalized = await targetCall('/api/portability/imports/' + job + '/finalize', 'POST', finalBody(records), cookie)
  expect(finalized.status, await finalized.clone().text()).toBe(200)
  for (const table of ['custom_field_definitions', 'custom_field_options']) {
    const rows = async (db: D1Database) => (await db.prepare('SELECT * FROM ' + table + ' ORDER BY id').all()).results
    expect((await rows(env.DB)).length, table).toBeGreaterThan(0)
    expect(await rows(destination.ARCHIVE_TARGET_DB), table + ' restored').toEqual(await rows(env.DB))
  }
  for (const id of issueIds) expect(await fieldsOf(destination.ARCHIVE_TARGET_DB, id)).toEqual(await fieldsOf(env.DB, id))
}
