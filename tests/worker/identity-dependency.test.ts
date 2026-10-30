import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { beforeAll, expect, inject, it, vi } from 'vitest'
import { request } from './base-auth-fixture'
import { keyPair, publicKey } from '../../vendor/base/dependencies/crypto.mjs'
import { openDependencyKey } from '../../vendor/base/dependencies/sealing.mjs'

const sector = crypto.randomUUID()
let legacyKey: Awaited<ReturnType<typeof keyPair>>

beforeAll(async () => {
  const migrations = inject('migrations')
  const boundary = migrations.findIndex(row => row.name === '0118_dependency_key_sealing.sql')
  expect(boundary).toBeGreaterThan(0)
  await applyD1Migrations(env.DB, migrations.slice(0, boundary))
  legacyKey = await keyPair()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO rer_dependency_installation(singleton,sector_id) VALUES(1,?)').bind(sector),
    env.DB.prepare('INSERT INTO rer_dependency_keys(interface,private_key) VALUES(?,?)').bind('oidc-provider@1', JSON.stringify(legacyKey)),
  ])
  await applyD1Migrations(env.DB, migrations.slice(boundary))
  const row = await env.DB.prepare('SELECT private_key FROM rer_dependency_keys').first<{private_key:string}>()
  // A failure must never serialize a private key into Vitest's assertion output.
  expect(row?.private_key === JSON.stringify(legacyKey)).toBe(true)
})

it('an optional Auth dependency stays unlinked and cannot bypass owner setup or sign-in', async () => {
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider request is allowed without approval'))
  try {
  expect((await request('/health')).status).toBe(200)
  const document = await request('/.well-known/rer-dependencies')
  expect(document.status).toBe(200)
  const value = await document.json() as {sector_id:string;dependencies: {interface: string; optional: boolean; provider: string | null}[]}
  expect(value.dependencies.some(d => d.interface === 'oidc-provider@1' && d.optional && d.provider === null)).toBe(true)
  expect(value.sector_id).toBe(sector)
  const jwks = await request('/.well-known/rer-link/jwks/oidc-provider@1')
  expect(jwks.status).toBe(200)
  expect(await jwks.json()).toEqual({keys:[publicKey(legacyKey)]})
  const stored = await env.DB.prepare('SELECT private_key FROM rer_dependency_keys').first<{private_key:string}>()
  const envelope = JSON.parse(stored!.private_key)
  expect(envelope.version === 1 && typeof envelope.ciphertext === 'string' && !('d' in envelope)).toBe(true)
  const custody = env as typeof env & {INSTALLATION_KEY:string}
  const opened = await openDependencyKey(custody, 'oidc-provider@1', stored!.private_key, {currentOnly:true})
  expect(JSON.stringify(opened.key) === JSON.stringify(legacyKey)).toBe(true)
  expect((await env.DB.prepare('SELECT keys_sealed FROM rer_dependency_installation').first())?.keys_sealed).toBe(1)
  expect((await request('/.well-known/rer-dependencies','GET',undefined,'',{INSTALLATION_KEY:undefined})).status).toBe(503)
  const wrong = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')
  expect((await request('/.well-known/rer-link/jwks/oidc-provider@1','GET',undefined,'',{INSTALLATION_KEY:wrong})).status).toBe(503)
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
