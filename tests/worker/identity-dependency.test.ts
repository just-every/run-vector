import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { beforeAll, expect, inject, it, vi } from 'vitest'
import { request } from './base-auth-fixture'

beforeAll(async () => applyD1Migrations(env.DB, inject('migrations')))

it('an optional Auth dependency stays unlinked and cannot bypass owner setup or sign-in', async () => {
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider request is allowed without approval'))
  try {
  expect((await request('/health')).status).toBe(200)
  const document = await request('/.well-known/rer-dependencies')
  expect(document.status).toBe(200)
  const value = await document.json() as {dependencies: {interface: string; optional: boolean; provider: string | null}[]}
  expect(value.dependencies.some(d => d.interface === 'oidc-provider@1' && d.optional && d.provider === null)).toBe(true)
  expect((await request('/auth/dependencies/status')).status).toBe(200)
  expect((await request('/auth/setup-complete')).status).toBe(405)
  expect((await request('/auth/setup-complete', 'POST', {})).status).toBe(403)
  expect((await request('/auth/oidc/auth/start', 'POST', {})).status).toBe(403)
  expect((await request('/auth/oidc/auth/callback?code=unapproved&state=unapproved')).status).toBe(403)
  const callback = await request('/.well-known/rer-link/callback', 'POST', {issuer: 'https://auth.example.test', code: 'unapproved'})
  expect(callback.status).toBe(403)
  expect((await env.DB.prepare('SELECT count(*) n FROM rer_dependency_link').first())?.n).toBe(0)
  expect((await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first())?.n).toBe(0)
  expect(network).not.toHaveBeenCalled()
  } finally { network.mockRestore() }
})
