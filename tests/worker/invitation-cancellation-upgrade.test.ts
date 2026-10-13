import { historicalAuth } from './historical-auth-fixture'
import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { expect, inject, it } from 'vitest'
import { ensureSampleData } from '../../src/core/features/sample-data/service'
import { bootstrapWorkspace } from '../../src/core/features/bootstrap/repository'
import { bindings, request, mailToken, confirm } from './base-auth-fixture'

it('[BASE-OPS-002 BASE-ACCESS-004] historical populated upgrade preserves sample data, mappings, credentials and outbox, then exercises cancellation on the current schema', async () => {
  const migrations = inject('migrations')
  const cancellation = migrations.find(migration => migration.name === '0012_invitation_cancellation.sql')
  const authBoundary = migrations.findIndex(migration => migration.name === '0011_base_operator_auth.sql')
  await applyD1Migrations(env.DB, migrations.slice(0, 2))
  await ensureSampleData(env.DB, new Date('2026-08-31T12:00:00.000Z'))
  await applyD1Migrations(env.DB, migrations.slice(2, authBoundary + 1))
  const owner = await env.DB.prepare("SELECT email FROM oa_operators WHERE status='active' ORDER BY id LIMIT 1").first<{email:string}>()
  await bootstrapWorkspace(env.DB, { ...bindings, FIRST_OWNER_EMAIL: owner!.email })
  const {cookie,invite} = await historicalAuth(owner!.email)
  const {cookie:acceptedCookie} = await invite('accepted@example.test',true)
  const {token:pendingToken} = await invite('pending@example.test')
  await invite('historical@example.test')
  // Existing inactive status is historical state, not evidence of cancellation.
  await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE email='historical@example.test'").run()
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results.map(row => row.name)
  const snapshot = () => Promise.all(tables.map(async table => ({ table, rows: (await env.DB.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()).results })))
  const before = await snapshot()
  expect((await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first())!.n).toBeGreaterThan(0)
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first())!.n).toBeGreaterThan(0)
  expect((await env.DB.prepare('SELECT count(*) n FROM vector_auth_operators').first())!.n).toBeGreaterThan(0)
  // Later migrations need their own populated previous-head transition proof.
  await applyD1Migrations(env.DB, [cancellation!])
  await applyD1Migrations(env.DB, [cancellation!])
  expect(await snapshot()).toEqual(before)
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_invitation_cancellations').first())!.n).toBe(0)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  // The historical transition above remains independently checked. The public
  // door below is today's app, which requires every later access migration.
  await applyD1Migrations(env.DB,migrations.slice(migrations.indexOf(cancellation!) + 1))
  expect((await request('/api/session', 'GET', undefined, cookie)).status).toBe(200)
  expect((await request('/api/session', 'GET', undefined, acceptedCookie)).status).toBe(200)
  expect((await request('/auth/confirm?token=' + pendingToken)).status).toBe(200)
  const pending = await env.DB.prepare("SELECT id,version FROM oa_operators WHERE email='pending@example.test'").first<{id:string,version:number}>()
  expect((await request('/auth/invite/cancel', 'POST', { operatorId: pending!.id }, cookie)).status).toBe(404)
  // Direct administrative cancellation is guarded too; the product route stays closed.
  await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE id=?").bind(pending!.id).run()
  expect(await env.DB.prepare('SELECT * FROM oa_invitation_cancellations').first()).toEqual({ operator_id: pending!.id, operator_version: pending!.version + 1 })
  expect((await request('/auth/confirm?token=' + pendingToken)).status).toBe(400)
  expect((await request('/auth/confirm', 'POST', {token: pendingToken})).status).toBe(400)
  await env.DB.prepare('DELETE FROM oa_sessions WHERE operator_id=?').bind(pending!.id).run()
  await env.DB.prepare('DELETE FROM oa_tokens WHERE operator_id=?').bind(pending!.id).run()
  await expect(env.DB.prepare("UPDATE oa_operators SET status='active' WHERE id=?").bind(pending!.id).run()).rejects.toThrow(/invitation_required/)
  await expect(env.DB.prepare('INSERT INTO oa_invitation_cancellations VALUES (?,?)').bind('missing-operator', 1).run()).rejects.toThrow(/FOREIGN KEY/)
  await expect(env.DB.prepare('DELETE FROM oa_operators WHERE id=?').bind(pending!.id).run()).rejects.toThrow(/FOREIGN KEY/)
  await env.DB.prepare("UPDATE oa_operators SET status='active' WHERE email='historical@example.test'").run()
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_invitation_cancellations').first())!.n).toBe(1)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  expect((await request('/api/session', 'GET', undefined, acceptedCookie)).status).toBe(200)
  expect((await request('/api/session','GET',undefined,cookie)).status).toBe(200)
  expect((await request('/api/session','GET',undefined,acceptedCookie)).status).toBe(200)
  expect((await request('/auth/request','POST',{email:owner!.email})).status).toBe(202)
  const fresh=await mailToken(owner!.email)
  const beforeLanding=(await env.DB.prepare('SELECT * FROM oa_tokens ORDER BY id').all()).results
  expect((await request('/auth/confirm?token='+fresh)).status).toBe(200)
  expect((await env.DB.prepare('SELECT * FROM oa_tokens ORDER BY id').all()).results).toEqual(beforeLanding)
  const freshCookie=await confirm(fresh)
  expect((await request('/api/session','GET',undefined,freshCookie)).status).toBe(200)
  // The three original invitation submissions require the current sender schema.
  // The historical accepted/pending/inactive records remain preserved.
  for (const email of ['forward-accepted@example.test','forward-pending@example.test','forward-historical@example.test']) {
    expect((await request('/api/settings/operators/invite','POST',{email,displayName:email.split('@')[0]},freshCookie)).status).toBe(202)
    const token=await mailToken(email)
    const tokens=(await env.DB.prepare('SELECT * FROM oa_tokens ORDER BY id').all()).results
    expect((await request('/auth/confirm?token='+token)).status).toBe(200)
    expect((await env.DB.prepare('SELECT * FROM oa_tokens ORDER BY id').all()).results).toEqual(tokens)
    if (email==='forward-accepted@example.test') expect((await request('/api/session','GET',undefined,await confirm(token))).status).toBe(200)
  }

})
