import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import type { WorkerBindings } from '../../src/core/app/bindings'

export const origin = 'http://127.0.0.1:15920'
export const bindings: WorkerBindings = {
  ...env, APP_ORIGIN: origin, SEED_SAMPLE_DATA: 'false', MAIL_MODE: 'local-outbox',
  SESSION_SECRET: 'synthetic-local-test-auth-secret-with-at-least-32-characters',
  MAIL_FROM: 'Vector <signin@vector.test>', FIRST_OWNER_EMAIL: 'owner@base.test',
  FIRST_OWNER_NAME: 'Owner', WORKSPACE_NAME: 'Base integration', WORKSPACE_TIMEZONE: 'UTC',
  DEFAULT_TEAM_NAME: 'Delivery', DEFAULT_TEAM_PREFIX: 'BASE',
  // The local key gate: the outbox answers only a request that holds it.
  RER_DEV_KEY: 'vector-test-dev-key-abcdefghijklmnopqrstuvwxyz0123456789',
}
const app = createServerApp()
export function request(path: string, method = 'GET', body?: unknown, cookie = '', overrides: Partial<WorkerBindings> = {}) {
  const current = { ...bindings, ...overrides }
  return app.request(current.APP_ORIGIN + path, { method, headers: {
    host: new URL(current.APP_ORIGIN).host, origin: current.APP_ORIGIN, cookie,
    'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.18',
  }, body: body === undefined ? undefined : JSON.stringify(body) }, current)
}
export async function mailToken(email: string) {
  const row = await env.DB.prepare("SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')=? ORDER BY created_at DESC,sequence DESC LIMIT 1").bind(email).first<{ text: string }>()
  expect(row).not.toBeNull()
  const url = row!.text.match(/https?:\/\/[^\s]+/)![0]
  expect(new URL(url).pathname).toBe('/auth/confirm')
  return new URL(url).searchParams.get('token')!
}
export async function confirm(token: string) {
  const response = await request('/auth/confirm', 'POST', { token })
  expect(response.status).toBe(303)
  return response.headers.get('set-cookie')!.split(';')[0]
}
export async function signIn(email = bindings.FIRST_OWNER_EMAIL!) {
  expect((await request('/auth/request', 'POST', { email })).status).toBe(202)
  return confirm(await mailToken(email))
}
/** An invitation names the role it grants; the form's default is Member. */
export async function invite(email: string, cookie: string, role?: 'owner' | 'admin' | 'member' | 'viewer') {
  const response = await request('/api/settings/operators/invite', 'POST', { email, displayName: email.split('@')[0], ...(role ? { role } : {}) }, cookie)
  expect(response.status).toBe(202)
  return confirm(await mailToken(email))
}
export async function actor(cookie: string) {
  const response = await request('/api/session', 'GET', undefined, cookie)
  expect(response.status).toBe(200)
  return (await response.json() as { operatorId: string }).operatorId
}
