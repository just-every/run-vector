import { requestFormsUpgrade } from './request-forms-upgrade'
import { it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { setupAdministration } from './administration-fixture'
import { actor, invite, request } from './base-auth-fixture'
import { beforeCommit } from './removal-interleaving'

it('[TRIAGE-004] published native forms retain exact versioned answers and enforce current team authority atomically', async () => {
  const f = await setupAdministration(), team = f.initial.teams[0], url = '/teams/' + team.id + '/request-forms'
  const input = { name: 'synthetic-vector-1880', published: true, fields: [
    { key: 'severity', label: 'Severity', help: 'Describe impact', type: 'choice', required: true, choices: ['Low', 'High'] },
    { key: 'steps', label: 'Steps', help: '', type: 'text', required: false, choices: [] },
    { key: 'count', label: 'Count', help: '', type: 'number', required: true, choices: [] },
    { key: 'blocked', label: 'Blocked', help: '', type: 'boolean', required: true, choices: [] },
  ] }
  const made = await f.call(url, 'POST', input); expect(made.status, await made.clone().text()).toBe(201)
  const form = await made.json() as any
  const answers = { severity: 'High', steps: '  Reproduce λ\nThen retry  ', count: 0, blocked: false }
  const payload = { teamId: team.id, title: 'synthetic-vector-1881', requestForm: { id: form.id, revision: 1, answers } }
  const tables = ['request_forms', 'request_form_revisions', 'request_form_submissions', 'issues', 'evidence_revisions', 'issue_activity', 'issue_followers', 'issue_mentions', 'notifications', 'notification_candidates', 'triage_creation_receipts', 'team_issue_sequences', 'issue_prefix_sequences', 'audit_records']
  const snapshot = () => Promise.all(tables.map(async table => ({ table, rows: (await env.DB.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()).results })))
  const unchanged = async (run: () => Promise<Response>, status: number) => { const before = await snapshot(), result = await run(); expect(result.status, await result.clone().text()).toBe(status); expect(await snapshot()).toEqual(before) }
  await unchanged(() => f.call('/intake', 'POST', { ...payload, requestForm: { ...payload.requestForm, answers: { count: 0, blocked: false } } }), 400)
  for (const invalid of [{ ...answers, severity: 'Unknown' }, { ...answers, count: '0' }, { ...answers, blocked: 'false' }, { ...answers, foreign: 'value' }]) await unchanged(() => f.call('/intake', 'POST', { ...payload, requestForm: { ...payload.requestForm, answers: invalid } }), 400)
  const recipient=await invite(['synthetic-vector-1896','example.test'].join('@'),f.cookie),recipientId=await actor(recipient)
  expect((await f.call('/settings/teams/'+team.id+'/members/'+recipientId,'PUT',{role:'member'})).status).toBe(200)
  const otherRecipient=await invite(['synthetic-vector-1897','example.test'].join('@'),f.cookie),otherRecipientId=await actor(otherRecipient)
  expect((await f.call('/settings/teams/'+team.id+'/members/'+otherRecipientId,'PUT',{role:'member'})).status).toBe(200)
  expect((await f.call('/settings/teams/'+team.id+'/triage-rotation','PUT',{startsLocal:'2026-01-05T09:00',operatorIds:[recipientId,otherRecipientId]})).status).toBe(200)
  const submitted = await f.call('/intake', 'POST', payload); expect(submitted.status, await submitted.clone().text()).toBe(201)
  const item = await submitted.json() as any
  const inboxes=await Promise.all([recipient,otherRecipient].map(cookie=>request('/api/notifications?limit=50','GET',undefined,cookie))),inboxItems=(await Promise.all(inboxes.map(async inbox=>(await inbox.json() as any).items))).flat()
  expect(inboxItems.filter((notice:any)=>notice.identifier===item.identifier&&notice.causes.includes('triage'))).toHaveLength(1)
  expect((await (await f.call('/notifications?limit=50')).json() as any).items.filter((notice:any)=>notice.identifier===item.identifier)).toEqual([])
  expect(await env.DB.prepare('SELECT count(*) n FROM triage_creation_receipts WHERE issue_id=?').bind(item.id).first<number>('n')).toBe(1)
  expect(item.status.category).toBe('intake'); expect(item.requestForm).toEqual({ id: form.id, revision: 1, name: input.name, fields: input.fields, answers })
  expect((await (await f.call('/issues/' + item.identifier)).json() as any).requestForm).toEqual(item.requestForm)
  expect((await env.DB.prepare('SELECT count(*) n FROM evidence_revisions WHERE issue_id=?').bind(item.id).first())?.n).toBe(1)
  const edited = await f.call(url + '/' + form.id, 'PUT', { ...input, name: 'synthetic-vector-1882', expectedRevision: 1 }); expect(edited.status).toBe(200)
  await unchanged(() => f.call('/intake', 'POST', payload), 409)
  await unchanged(() => f.call(url + '/' + form.id, 'PUT', { ...input, expectedRevision: 1 }), 409)
  expect((await (await f.call('/issues/' + item.identifier)).json() as any).requestForm).toEqual(item.requestForm)
  payload.requestForm.revision = 2
  const member = await invite(['synthetic-vector-1883', 'example.test'].join('@'), f.cookie), memberId = await actor(member)
  const memberCall = (path: string, method = 'GET', body?: unknown) => request('/api' + path, method, body, member)
  await f.call('/settings/teams/' + team.id + '/members/' + memberId, 'PUT', { role: 'member' })
  await f.call('/settings/teams/' + team.id + '/permissions', 'PUT', { settings: 'all_members', planning: 'team_owners' })
  expect((await memberCall(url, 'POST', input)).status).toBe(201)
  await f.call('/settings/teams/' + team.id + '/permissions', 'PUT', { settings: 'team_owners', planning: 'all_members' })
  await unchanged(() => memberCall(url, 'POST', input), 403)
  await unchanged(() => memberCall(url + '/' + form.id, 'PUT', { ...input, expectedRevision: 2 }), 403)
  expect((await memberCall('/intake', 'POST', payload)).status).toBe(201)
  await f.call('/settings/teams/' + team.id + '/members/' + memberId, 'PUT', { role: 'owner' })
  expect((await memberCall(url, 'POST', input)).status).toBe(201)
  const admin = await invite(['synthetic-vector-1884', 'example.test'].join('@'), f.cookie, 'admin')
  expect((await request('/api' + url, 'POST', input, admin)).status).toBe(201)
  const guest = await invite(['synthetic-vector-1885', 'example.test'].join('@'), f.cookie), guestId = await actor(guest)
  await f.call('/settings/operators/' + guestId + '/role', 'PATCH', { role: 'guest', teamIds: [team.id] })
  const guestCall = (path: string, method = 'GET', body?: unknown) => request('/api' + path, method, body, guest)
  for (const setting of ['all_members', 'team_owners']) {
    await f.call('/settings/teams/' + team.id + '/permissions', 'PUT', { settings: setting, planning: 'all_members' })
    await unchanged(() => guestCall(url + '/' + form.id, 'PUT', { ...input, expectedRevision: 2 }), 403)
    const res = await guestCall('/intake', 'POST', payload); expect(res.status, await res.clone().text()).toBe(201)
    expect((await res.json() as any).requestForm.answers).toEqual(answers)
  }
  await f.call('/settings/teams/' + team.id + '/members/' + guestId, 'DELETE')
  await unchanged(() => guestCall('/intake', 'POST', payload), 404)
  expect((await guestCall(url)).status).toBe(404)
  const viewer = await invite(['synthetic-vector-1886', 'example.test'].join('@'), f.cookie, 'viewer')
  await unchanged(() => request('/api' + url, 'POST', input, viewer), 403)
  await unchanged(() => request('/api/intake', 'POST', payload, viewer), 403)
  const sessionCookie=await invite(['synthetic-vector-1898','example.test'].join('@'),f.cookie)
  const ended=beforeCommit(sql=>/insert into issues/i.test(sql),async()=>{expect((await request('/auth/signout','POST',{},sessionCookie)).status).toBe(204)})
  const beforeEnded=await snapshot(),endedResponse=await request('/api/intake','POST',payload,sessionCookie,{DB:ended});expect(endedResponse.status).toBe(401)
  const withoutReservations=(rows:Awaited<ReturnType<typeof snapshot>>)=>rows.filter(t=>!['team_issue_sequences','issue_prefix_sequences'].includes(t.table))
  expect(withoutReservations(await snapshot())).toEqual(withoutReservations(beforeEnded))
  // A private team's definition is concealed before its contents can be read.
  const other = await f.mutate('/settings/teams', 'POST', { name: 'synthetic-vector-1887', identifierPrefix: 'RQST' }), privateTeam = other.teams.find(t => t.identifierPrefix === 'RQST')!
  const privateUrl = '/teams/' + privateTeam.id + '/request-forms', privateMade = await f.call(privateUrl, 'POST', input), privateForm = await privateMade.json() as any
  await f.call('/settings/teams/' + privateTeam.id + '/privacy', 'PUT', { isPrivate: true })
  expect((await memberCall(privateUrl)).status).toBe(404)
  await unchanged(() => memberCall('/intake', 'POST', { ...payload, teamId: privateTeam.id, requestForm: { ...payload.requestForm, id: privateForm.id, revision: 1 } }), 404)
  // Publication and current authority are rechecked inside the committing batch.
  await f.call('/settings/teams/' + team.id + '/permissions', 'PUT', { settings: 'all_members', planning: 'all_members' })
  await f.call('/settings/teams/' + team.id + '/members/' + memberId, 'PUT', { role: 'member' })
  const withdrawn = beforeCommit(sql => sql.includes('INSERT INTO request_forms'), async () => { await f.call('/settings/teams/' + team.id + '/permissions', 'PUT', { settings: 'team_owners', planning: 'all_members' }) })
  const beforeWithdrawal = await snapshot(), refused = await request('/api' + url, 'POST', input, member, { DB: withdrawn }); expect(refused.status).toBe(409)
  expect((await snapshot()).filter(t => t.table !== 'audit_records')).toEqual(beforeWithdrawal.filter(t => t.table !== 'audit_records'))
  const revised = beforeCommit(sql => /insert into issues/i.test(sql), async () => { await f.call(url + '/' + form.id, 'PUT', { ...input, published: false, expectedRevision: 2 }) })
  const beforeRevision = await snapshot(), stale = await request('/api/intake', 'POST', payload, f.cookie, { DB: revised }); expect(stale.status).toBe(409)
  expect((await snapshot()).filter(t => !['request_forms', 'request_form_revisions', 'audit_records', 'team_issue_sequences', 'issue_prefix_sequences'].includes(t.table))).toEqual(beforeRevision.filter(t => !['request_forms', 'request_form_revisions', 'audit_records', 'team_issue_sequences', 'issue_prefix_sequences'].includes(t.table)))
  await unchanged(() => f.call('/intake', 'POST', { ...payload, requestForm: { ...payload.requestForm, revision: 3 } }), 404)
  const ordinary = await f.call('/intake', 'POST', { teamId: team.id, title: 'synthetic-vector-1888', measurements: { severity: 'ordinary' } }); expect(ordinary.status).toBe(201)
  expect((await ordinary.json() as any).requestForm).toBeNull()
  await requestFormsUpgrade()
}, 90000)
