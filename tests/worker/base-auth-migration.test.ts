import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { expect, inject, it } from 'vitest'
import { bindings, request } from './base-auth-fixture'
import { legacyCookie } from './historical-auth-fixture'

it('[BASE-OPS-002 OPS-001] additive Base import preserves product and old credential history without admitting old remote cookies', async () => {
  const migrations = inject('migrations')
  await applyD1Migrations(env.DB,migrations.slice(0,10))
  // Seed the workspace a 0010 installation bootstrapped; today's bootstrap
  // also records the 0034 restore snapshot, which this schema predates.
  const at = '2026-08-01T00:00:00.000Z', workspace = '01J00000000000000000000901', team = '01J00000000000000000000903'
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspace_bootstrap(id,workspace_id,created_at) VALUES(1,?,?)').bind(workspace,at),
    env.DB.prepare('INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)').bind(workspace,bindings.WORKSPACE_NAME,bindings.WORKSPACE_TIMEZONE,at,at),
    env.DB.prepare('INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('01J00000000000000000000902',workspace,bindings.FIRST_OWNER_NAME,bindings.FIRST_OWNER_EMAIL,at,at),
    env.DB.prepare('INSERT INTO workspace_installation(workspace_id,setup_operator_id,created_at,updated_at) VALUES(?,?,?,?)').bind(workspace,'01J00000000000000000000902',at,at),
    env.DB.prepare('INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(team,workspace,bindings.DEFAULT_TEAM_NAME,bindings.DEFAULT_TEAM_PREFIX,at,at),
    ...[['Intake','intake'],['Backlog','backlog'],['Todo','unstarted'],['In progress','started'],['Done','completed'],['Canceled','canceled'],['Duplicate','duplicate']].map(([name,category],position) =>
      env.DB.prepare('INSERT INTO workflow_statuses(id,team_id,name,category,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(`01J0000000000000000000091${position}`,team,name,category,position,at,at)),
  ])
  const owner = (await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
  const cookie = await legacyCookie(owner)
  const tables = ['operators','operator_sessions','workspace_settings','workspace_installation','teams','workflow_statuses']
  const before = await Promise.all(tables.map(table => env.DB.prepare(`SELECT * FROM ${table}`).all().then(result => result.results)))
  await applyD1Migrations(env.DB,migrations.slice(10))
  await applyD1Migrations(env.DB,migrations.slice(10))
  const expected=before.map((rows,index)=>tables[index]==='workspace_installation'?rows.map(row=>({...row,setup_completed_at:row.updated_at})):rows)
  const after = await Promise.all(tables.map(table => env.DB.prepare(`SELECT * FROM ${table}`).all().then(result => result.results)))
  const originalColumns = after.map((rows, index) => tables[index] === 'workspace_settings' ? rows.map(({ reminder_time, ...original }) => {
    expect(reminder_time).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    return original
  }) : rows)
  expect(originalColumns).toEqual(expected)
  expect(await env.DB.prepare('SELECT auth_id,operator_id FROM vector_auth_operators').first()).toEqual({auth_id:owner,operator_id:owner})
  expect(await env.DB.prepare('SELECT role,status FROM oa_operators').first()).toEqual({role:'owner',status:'active'})
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_bootstrap').first())?.n).toBe(1)
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first())?.n).toBe(0)
  expect((await request('/api/session','GET',undefined,cookie,{
    APP_ORIGIN:'https://vector.example.test', MAIL_MODE:'sendgrid', MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-test-key',
  })).status).toBe(401)
})
