import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import type { WorkerBindings } from '../../src/core/app/bindings'

export const origin = 'http://127.0.0.1:15920'
export const bindings: WorkerBindings = {
  ...env, APP_ORIGIN: origin, SEED_SAMPLE_DATA: 'false', MAIL_MODE: 'local-outbox',
  SESSION_SECRET: 'local-test-auth-secret-with-at-least-32-characters',
  MAIL_FROM: 'Vector <signin@vector.test>', FIRST_OWNER_EMAIL: 'owner@base.test',
  FIRST_OWNER_NAME: 'Owner', WORKSPACE_NAME: 'Base integration', WORKSPACE_TIMEZONE: 'UTC',
  DEFAULT_TEAM_NAME: 'Delivery', DEFAULT_TEAM_PREFIX: 'BASE',
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
  const row = await env.DB.prepare('SELECT sign_in_url FROM local_mail_outbox WHERE recipient=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(email).first<{ sign_in_url: string }>()
  expect(row).not.toBeNull()
  expect(new URL(row!.sign_in_url).pathname).toBe('/auth/confirm')
  return new URL(row!.sign_in_url).searchParams.get('token')!
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
export async function invite(email: string, cookie: string) {
  const response = await request('/api/settings/operators/invite', 'POST', { email, displayName: email.split('@')[0] }, cookie)
  expect(response.status).toBe(202)
  return confirm(await mailToken(email))
}
export async function actor(cookie: string) {
  const response = await request('/api/session', 'GET', undefined, cookie)
  expect(response.status).toBe(200)
  return (await response.json() as { operatorId: string }).operatorId
}
