import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { expect, inject, it } from 'vitest'
import { bootstrapWorkspace } from '../../src/core/features/bootstrap/repository'
import { bindings, request } from './base-auth-fixture'
import { testCookie } from './native-fixture'

it('[BASE-OPS-002 OPS-001] additive Base import preserves product and old credential history without admitting old remote cookies', async () => {
  const migrations = inject('migrations')
  await applyD1Migrations(env.DB,migrations.slice(0,10))
  await bootstrapWorkspace(env.DB,bindings)
  const owner = (await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
  const cookie = await testCookie(env.DB,owner)
  const tables = ['operators','operator_sessions','workspace_settings','workspace_installation','teams','workflow_statuses']
  const before = await Promise.all(tables.map(table => env.DB.prepare(`SELECT * FROM ${table}`).all().then(result => result.results)))
  await applyD1Migrations(env.DB,migrations.slice(10))
  await applyD1Migrations(env.DB,migrations.slice(10))
  expect(await Promise.all(tables.map(table => env.DB.prepare(`SELECT * FROM ${table}`).all().then(result => result.results)))).toEqual(before)
  expect(await env.DB.prepare('SELECT auth_id,operator_id FROM vector_auth_operators').first()).toEqual({auth_id:owner,operator_id:owner})
  expect(await env.DB.prepare('SELECT role,status FROM oa_operators').first()).toEqual({role:'owner',status:'active'})
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_bootstrap').first())?.n).toBe(1)
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first())?.n).toBe(0)
  expect((await request('/api/session','GET',undefined,cookie,{
    APP_ORIGIN:'https://vector.example.test', MAIL_MODE:'sendgrid', MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-test-key',
  })).status).toBe(401)
})
