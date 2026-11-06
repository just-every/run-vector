import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import { invite, request } from './base-auth-fixture'
import { resetLimits, type roleWorkspace } from './role-fixture'

type Workspace = Awaited<ReturnType<typeof roleWorkspace>>
type Send = (path: string, method?: string, body?: unknown) => Promise<Response>
export type Severity = { id: string; version: number; options: { id: string; name: string }[] }

export const json = async (response: Response | Promise<Response>, status = 200): Promise<any> => {
  const settled = await response
  expect(settled.status, await settled.clone().text()).toBe(status)
  return settled.json()
}
/** Every stored row except request counters: a refusal must leave all of it as it was. */
export async function stored() {
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' AND name NOT IN ('access_rate_limits','oa_limits','integration_token_usage') ORDER BY name")
    .all<{ name: string }>()).results.map(row => row.name)
  const results = await env.DB.batch(tables.map(name => env.DB.prepare('SELECT * FROM "' + name + '"')))
  return Object.fromEntries(tables.map((name, index) => [name, results[index]!.results.map(row => JSON.stringify(row)).sort()]))
}
/** The request is refused with `status` and writes nothing. */
export async function refused(send: () => Promise<Response>, status: number, label: string) {
  await resetLimits()
  const before = await stored(), response = await send()
  expect(response.status, label + ': ' + await response.clone().text()).toBe(status)
  expect(await stored(), label + ' wrote nothing').toEqual(before)
  return response
}
const severityInput = (name = 'Severity') => ({ name, description: 'How badly the problem hurts', type: 'single_select', options: [{ name: 'Minor' }, { name: 'Major' }, { name: 'Critical' }] })
const fieldsOf = (state: any, team: string) => state.teams.find((row: any) => row.id === team).customFields as Severity[] & { name: string }[]
export const severityOf = (state: any, team: string, name = 'Severity') => fieldsOf(state, team).find((row: any) => row.name === name) as Severity
const optionId = (field: Severity, name: string) => field.options.find(option => option.name === name)!.id
const updates = async (issueId: string) => (await env.DB.prepare("SELECT actor_operator_id AS actor,previous_value_json AS previous,next_value_json AS next FROM issue_activity WHERE issue_id=? AND kind='issue.updated' ORDER BY rowid")
  .bind(issueId).all<{ actor: string; previous: string; next: string }>()).results.map(row => ({ actor: row.actor, previous: JSON.parse(row.previous), next: JSON.parse(row.next) }))
const storedFields = async (issueId: string) => JSON.parse((await env.DB.prepare('SELECT custom_fields_json AS v FROM issues WHERE id=?').bind(issueId).first<string>('v'))!)

/** Who may define a team field: team owners, or every member while the team lets all
 * members manage its settings; never a Guest or Viewer; hidden teams stay hidden. */
export async function severityDefinitions(w: Workspace) {
  const { owner, admin, lead, member, guest } = w.people, team = w.team.id
  const viewer = { cookie: await invite('synthetic-vector-field-viewer@vector.test', owner.cookie, 'viewer') }
  const viewerCall: Send = (path, method = 'GET', body) => request('/api' + path, method, body, viewer.cookie)
  const other = (await w.mutate('/settings/teams', 'POST', { name: 'synthetic-vector-field-other', identifierPrefix: 'FLDOTH' })).teams.find(row => row.name === 'synthetic-vector-field-other')!.id
  const hidden = (await w.mutate('/settings/teams', 'POST', { name: 'synthetic-vector-field-hidden', identifierPrefix: 'FLDHID', isPrivate: true })).teams.find(row => row.name === 'synthetic-vector-field-hidden')!.id
  const create = (send: Send, teamId = team, input: object = severityInput()) => send(`/settings/teams/${teamId}/custom-fields`, 'POST', input)
  // Default "Team owners only": a Member who does not own the team is refused 403 and nothing is written.
  expect((await w.state()).teams.find(row => row.id === team)!.settingsPermission).toBe('team_owners')
  for (const [label, send] of [['member', member.call], ['guest', guest.call], ['viewer', viewerCall]] as const)
    await refused(() => create(send), 403, label + ' defines a team field')
  const severity = severityOf(await json(create(lead.call)), team)
  expect(severity.options.map(option => option.name)).toEqual(['Minor', 'Major', 'Critical'])
  expect(new Set(severity.options.map(option => option.id)).size).toBe(3)
  // A name is unique in its team only, whatever its case.
  await refused(() => create(admin.call, team, severityInput('severity')), 409, 'duplicate team field name')
  const foreign = severityOf(await json(create(owner.call, other)), other)
  expect(foreign.id).not.toBe(severity.id)
  // Both values of the team's permission, effective on the member's next request.
  expect((await owner.call(`/settings/teams/${team}/permissions`, 'PUT', { settings: 'all_members', planning: 'all_members' })).status).toBe(200)
  expect(severityOf(await json(create(member.call, team, severityInput('Impact'))), team, 'Impact').options).toHaveLength(3)
  await refused(() => create(guest.call, team, severityInput('Guest field')), 403, 'guest under all members')
  expect((await owner.call(`/settings/teams/${team}/permissions`, 'PUT', { settings: 'team_owners', planning: 'all_members' })).status).toBe(200)
  await refused(() => create(member.call, team, severityInput('Withdrawn')), 403, 'member after the permission returns to team owners')
  // A private team the member does not belong to is refused like any team they do not
  // manage, and its fields never appear in their Settings or /api/v1 metadata.
  await json(create(owner.call, hidden, severityInput('Hidden severity')))
  await refused(() => create(member.call, hidden, severityInput('Probe')), 403, 'member on a private team')
  for (const read of [member.call('/settings/administration'), member.api('/metadata')]) {
    const state = await json(read)
    expect(JSON.stringify(state)).not.toContain('Hidden severity')
    expect(severityOf(state, team).options).toEqual(severity.options)
  }
  return { severity, foreign, other, hidden, viewerCall }
}

/** Values through the browser door and /api/v1, with typed refusals, one attributed
 * old/new activity per actual change, and a rename that keeps stored identity. */
export async function severityValues(w: Workspace, fields: Awaited<ReturnType<typeof severityDefinitions>>) {
  const { owner, admin, lead, member, guest } = w.people, { severity, foreign, other, viewerCall } = fields
  const legacy = { department: 'Platform', nested: [3, null, { preserve: true }] }
  const issue = await json(owner.call('/issues', 'POST', { title: 'synthetic-vector-severity-issue', teamId: w.team.id, customFields: legacy }), 201)
  expect(issue.fields.map((field: any) => field.id)).toContain(severity.id)
  const major = optionId(severity, 'Major'), critical = optionId(severity, 'Critical')
  let version = issue.version
  const patch = (send: Send, value: unknown, expectedVersion = version) =>
    send('/issues/' + issue.identifier, 'PATCH', { expectedVersion, customFields: { ...legacy, [severity.id]: value } })
  // Browser door (native session), then /api/v1 (bearer).
  version = (await json(patch(owner.call, major))).version
  const viaApi = await json(patch(member.api, critical))
  expect(viaApi.customFields).toEqual({ ...legacy, [severity.id]: critical })
  version = viaApi.version
  // The same value again is no change: no activity and no new version.
  expect((await json(patch(member.api, critical))).version).toBe(version)
  // Typed refusals change nothing: a number, another team's option or field, an unknown option.
  await refused(() => patch(member.api, 3), 400, 'number through /api/v1')
  await refused(() => patch(owner.call, 3), 400, 'number through the browser door')
  await refused(() => patch(owner.call, foreign.options[0]!.id), 400, 'another team field option')
  await refused(() => owner.call('/issues/' + issue.identifier, 'PATCH', { expectedVersion: version, customFields: { ...legacy, [severity.id]: critical, [foreign.id]: foreign.options[0]!.id } }), 400, 'another team field')
  await refused(() => patch(owner.call, 'synthetic-vector-unknown-option'), 400, 'unknown option')
  await refused(() => patch(owner.call, major, version - 1), 409, 'stale version')
  // Role rule for values: an invited Guest may set it, a Viewer may not, a Guest outside the team sees nothing.
  version = (await json(patch(guest.call, major))).version
  await refused(() => patch(viewerCall, critical), 403, 'viewer value')
  const elsewhere = await json(owner.call('/issues', 'POST', { title: 'synthetic-vector-severity-elsewhere', teamId: other }), 201)
  await refused(() => guest.call('/issues/' + elsewhere.identifier, 'PATCH', { expectedVersion: elsewhere.version, customFields: { [foreign.id]: foreign.options[0]!.id } }), 404, 'guest outside the team')
  // null clears the typed value; legacy keys stay exactly as they were.
  version = (await json(patch(admin.api, null))).version
  expect(await storedFields(issue.id)).toEqual(legacy)
  version = (await json(patch(lead.call, critical))).version
  const history = (await updates(issue.id)).filter(row => 'customFields' in row.next)
  expect(history.map(row => [row.actor, row.previous.customFields[severity.id] ?? null, row.next.customFields[severity.id] ?? null])).toEqual([
    [owner.id, null, major], [member.id, major, critical], [guest.id, critical, major], [admin.id, major, null], [lead.id, null, critical]])
  expect(history.every(row => row.previous.customFields.department === 'Platform' && row.next.customFields.department === 'Platform')).toBe(true)
  // Renaming an option keeps its identity: stored values, versions and history do not move.
  const before = await stored()
  const renamed = severityOf(await json(lead.call(`/settings/teams/${w.team.id}/custom-fields/${severity.id}`, 'PATCH', {
    expectedVersion: severity.version, options: severity.options.map(option => ({ id: option.id, name: option.name === 'Critical' ? 'Blocker' : option.name })) })), w.team.id)
  expect(renamed.options.find(option => option.id === critical)!.name).toBe('Blocker')
  const after = await stored()
  for (const table of ['issues', 'issue_activity', 'team_issue_sequences']) expect(after[table], table + ' unchanged by a rename').toEqual(before[table])
  const read = await json(member.api('/issues/' + issue.identifier))
  expect(read.customFields[severity.id]).toBe(critical)
  expect(read.fields.find((field: any) => field.id === severity.id).options.find((option: any) => option.id === critical).name).toBe('Blocker')
  // A concurrent option change made from the old version is refused whole; a value
  // chosen before the rename still names the same option afterwards.
  await refused(() => admin.call(`/settings/teams/${w.team.id}/custom-fields/${severity.id}`, 'PATCH', {
    expectedVersion: severity.version, options: [...severity.options, { name: 'Trivial' }] }), 409, 'option change from a stale field version')
  version = (await json(patch(member.call, major))).version
  expect((await storedFields(issue.id))[severity.id]).toBe(major)
  return { issue: { ...issue, version }, legacy, renamed }
}
