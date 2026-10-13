import {legacyCookie} from './historical-auth-fixture'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { beforeAll, expect, inject, it, vi } from 'vitest'
import { actor, bindings, invite, mailToken, request, signIn } from './base-auth-fixture'
import { beforeCommit } from './removal-interleaving'

beforeAll(async () => applyD1Migrations(env.DB, inject('migrations')))
let ownerCookie: string
let ownerId: string
it('[OPS-001 OPS-002 TEAM-002] configured bootstrap atomically maps one equal Base operator and remains idempotent', async () => {
  expect((await request('/health')).status).toBe(200)
  expect((await request('/health')).status).toBe(200)
  for (const table of ['operators','oa_operators','vector_auth_operators','oa_bootstrap','teams'])
    expect((await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first())?.n).toBe(1)
  expect((await env.DB.prepare('SELECT count(DISTINCT category) n FROM workflow_statuses').first())?.n).toBe(7)
  expect((await env.DB.prepare('SELECT role,status FROM oa_operators').first())).toEqual({ role: 'owner', status: 'active' })
  expect((await request('/auth/bootstrap', 'POST', { token: 'not-enabled' })).status).toBe(404)
})
it('[BASE-ACCESS-001 BASE-ACCESS-004] Base confirmation preview is side-effect-free and POST consumes once and unfinished owner review takes precedence', async () => {
  expect((await request('/auth/magic-link','POST',{email: bindings.FIRST_OWNER_EMAIL,returnTo:'/app/settings'})).status).toBe(202)
  const token = await mailToken(bindings.FIRST_OWNER_EMAIL!)
  for (const method of ['GET','HEAD']) {
    const preview = await request('/auth/confirm?token='+token, method)
    expect(preview.status).toBe(200)
    expect(preview.headers.get('set-cookie')).toBeNull()
  }
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first())?.n).toBe(0)
  const response = await request('/auth/confirm','POST',{token})
  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe('/setup')
  ownerCookie = response.headers.get('set-cookie')!.split(';')[0]
  expect(ownerCookie.startsWith('operator_session_local_15920=')).toBe(true)
  ownerId = await actor(ownerCookie)
  expect((await request('/api/setup/complete','POST',{confirmed:true},ownerCookie)).status).toBe(200)

  expect((await request('/auth/confirm','POST',{token})).status).toBe(400)
  expect((await request('/auth/confirm?token='+token)).status).toBe(400)
})
it('[OPS-001 OPS-002 BASE-ACCESS-002] unauthorized invites make no records; equal operators invite and cannot bypass safe removal', async () => {
  const before = (await env.DB.prepare('SELECT count(*) n FROM oa_operators').first())?.n
  expect((await request('/api/settings/operators/invite','POST',{email:'outsider@base.test',displayName:'Outsider'})).status).toBe(401)
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_operators').first())?.n).toBe(before)
  const peer = await invite('peer@base.test',ownerCookie)
  const next = await invite('next@base.test',peer)
  expect(await actor(next)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  expect((await request('/api/settings/operators/'+ownerId,'DELETE',undefined,peer)).status).toBe(409)
  for (const path of ['/auth/invite','/auth/operator/status','/auth/operator/role'])
    expect((await request(path,'POST',{operatorId:ownerId,status:'inactive'},peer)).status).toBe(404)
})
it('[BASE-ACCESS-001] remote configuration fails visibly and legacy local credentials cannot authenticate a remote deployment', async () => {
  const remote = { APP_ORIGIN: 'https://vector.example.test', MAIL_MODE: 'sendgrid', MAIL_PROVIDER:'sendgrid', MAIL_API_KEY:'synthetic-test-key' }
  expect((await request('/auth/request','POST',{email:bindings.FIRST_OWNER_EMAIL},'',{...remote,SESSION_SECRET:undefined})).status).toBe(503)
  expect((await request('/api/session','GET',undefined,await legacyCookie(ownerId),remote)).status).toBe(401)
  expect((await request('/auth/consume?token='+'a'.repeat(64),'GET',undefined,'',remote)).status).toBe(404)
})
it('[BASE-ACCESS-001] real Base SendGrid serialization and rejected/uncertain delivery revoke links without retry or local fallback', async () => {
  const remote = { APP_ORIGIN: 'https://vector.example.test', MAIL_MODE:'sendgrid', MAIL_PROVIDER:'sendgrid', MAIL_API_KEY:'synthetic-test-key' }
  const send = vi.spyOn(globalThis,'fetch')
  try {
    for (const status of [400,429,500]) {
      send.mockResolvedValueOnce(new Response('{}',{status}))
      const response = await request('/auth/request','POST',{email:bindings.FIRST_OWNER_EMAIL},'',remote)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({error:'mail_unavailable'})
      const row = await env.DB.prepare('SELECT revoked_at FROM oa_tokens ORDER BY created_at DESC,rowid DESC LIMIT 1').first()
      expect(row?.revoked_at).not.toBeNull()
    }
    expect(send).toHaveBeenCalledTimes(3)
    const [url, options] = send.mock.calls[0]
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    const wire = JSON.parse(String(options!.body))
    expect(wire.personalizations[0].to[0].email).toBe(bindings.FIRST_OWNER_EMAIL)
    expect(wire.content[0].value).toContain('https://vector.example.test/auth/confirm?token=')
    expect(wire.tracking_settings.click_tracking.enable).toBe(false)
  } finally { send.mockRestore() }
})
it('[OPS-004 BASE-ACCESS-002] removal atomically revokes Base sessions, unused links and invitations issued by the removed actor', async () => {
  const cookie = await signIn('peer@base.test')
  const peerId = await actor(cookie)
  const priorVersion = (await env.DB.prepare('SELECT a.version FROM oa_operators a JOIN vector_auth_operators m ON a.id=m.auth_id WHERE m.operator_id=?').bind(peerId).first<{version:number}>())!.version
  expect((await request('/auth/magic-link','POST',{email:'peer@base.test'})).status).toBe(202)
  const unconsumed = await mailToken('peer@base.test')
  expect((await request('/api/settings/operators/invite','POST',{email:'pending@base.test',displayName:'Pending'},cookie)).status).toBe(202)
  const pending = await mailToken('pending@base.test')
  expect((await request('/api/settings/operators/'+peerId,'DELETE',undefined,ownerCookie)).status).toBe(200)
  expect((await request('/api/session','GET',undefined,cookie)).status).toBe(401)
  for (const token of [unconsumed,pending]) {
    expect((await request('/auth/confirm?token='+token)).status).toBe(400)
    expect((await request('/auth/confirm','POST',{token})).status).toBe(400)
  }
  expect(await env.DB.prepare(`SELECT a.status,a.version FROM oa_operators a JOIN vector_auth_operators m ON a.id=m.auth_id WHERE m.operator_id=?`).bind(peerId).first()).toEqual({status:'inactive',version:priorVersion+1})
})
it('[OPS-004 BASE-ACCESS-002] a Base session revoked after validation cannot commit an application mutation', async () => {
  const cookie = await signIn('next@base.test')
  const id = await actor(cookie)
  const before = await env.DB.prepare('SELECT timezone FROM workspace_settings').first()
  const db = beforeCommit(sql => sql.includes('UPDATE workspace_settings'), async () => {
    await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)').bind(Date.now(),id).run()
  })
  expect((await request('/api/settings','PATCH',{timezone:'Australia/Brisbane'},cookie,{DB:db})).status).toBe(401)
  expect(await env.DB.prepare('SELECT timezone FROM workspace_settings').first()).toEqual(before)
})
it('[BASE-ACCESS-001 BASE-ACCESS-004] remote request adapter creates a genuine Base secure session and signout revokes it', async () => {
  const remote = { APP_ORIGIN: 'https://vector.example.test', MAIL_MODE:'sendgrid', MAIL_PROVIDER:'sendgrid', MAIL_API_KEY:'synthetic-test-key' }
  const send = vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(null,{status:202,headers:{'x-message-id':'synthetic-provider-receipt'}}))
  let token: string
  try {
    expect((await request('/auth/request','POST',{email:bindings.FIRST_OWNER_EMAIL,returnTo:'https://untrusted.test'},'',remote)).status).toBe(202)
    const wire = JSON.parse(String(send.mock.calls[0][1]!.body))
    token = new URL(wire.content[0].value.match(/https:\/\/[^\s]+/)[0]).searchParams.get('token')!
  } finally { send.mockRestore() }
  const preview = await request('/auth/confirm?token='+token,'GET',undefined,'',remote)
  expect(preview.status).toBe(200)
  expect(preview.headers.get('set-cookie')).toBeNull()
  const result = await request('/auth/confirm','POST',{token},'',remote)
  expect(result.status).toBe(303)
  expect(result.headers.get('location')).toBe('/app')
  expect(result.headers.get('set-cookie')).toContain('; Secure')
  const cookie = result.headers.get('set-cookie')!.split(';')[0]
  expect(cookie.startsWith('__Host-operator_session=')).toBe(true)
  expect((await request('/api/session','GET',undefined,cookie,remote)).status).toBe(200)
  expect((await request('/auth/signout','POST',{},cookie,remote)).status).toBe(200)
  expect((await request('/api/session','GET',undefined,cookie,remote)).status).toBe(401)
})
it('[BASE-OPS-001] configured deployment health identifies the source, fingerprint and running version after schema readiness', async () => {
  const response = await request('/health','GET',undefined,'',{
    RER_DEPLOY_SOURCE:'a'.repeat(40),RER_DEPLOY_FINGERPRINT:'b'.repeat(64),RER_VERSION:{id:'local-test-version'},
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({status:'ok',ok:true,deployment:{sourceSha:'a'.repeat(40),fingerprint:'b'.repeat(64),versionId:'local-test-version'}})
})
it('[OPS-002 OPS-004] setup owner self-removal preserves the equal successor and last-operator guard under Base sessions', async () => {
  const successor = await signIn('next@base.test')
  const successorId = await actor(successor)
  const removed = await request('/api/settings/operators/'+ownerId,'DELETE',undefined,ownerCookie)
  expect(removed.status).toBe(200)
  expect(removed.headers.get('set-cookie')).toContain('operator_session_local_15920=;')
  expect((await request('/api/session','GET',undefined,ownerCookie)).status).toBe(401)
  expect((await request('/api/settings/operators/'+successorId,'DELETE',undefined,successor)).status).toBe(409)
  expect((await env.DB.prepare("SELECT count(*) n FROM oa_operators WHERE status='active' AND role='owner'").first())?.n).toBe(1)
})
