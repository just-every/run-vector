import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import assert from 'node:assert/strict'
import { afterAll, beforeAll, inject, it, vi } from 'vitest'
import { createServerApp } from '../../src/core/app/server'
import { ensureSampleData } from '../../src/core/features/sample-data/service'
import { vectorSampleIds as ids } from '../../sample-data/vector'
import { testCookie } from './native-fixture'
const app = createServerApp(),
  origin = 'https://127.0.0.1:15920'
const bindings = { ...env, APP_ORIGIN: origin, MAIL_MODE: 'local-outbox' }
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await ensureSampleData(env.DB, new Date())
})
afterAll(() => vi.useRealTimers())
const get = (cookie: string) =>
  app.request(origin + '/api/session', { headers: { host: new URL(origin).host, cookie } }, bindings)

it('[BASE-ACCESS-004] a person sending too many requests in a minute is refused with 429, without touching another person or the next minute', async () => {
  // The limit counts calendar minutes; hold the clock inside one so the run cannot straddle a boundary.
  const minute = Math.ceil(Date.now() / 60_000) * 60_000
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(minute + 5_000)
  const sarah = await testCookie(env.DB, ids.sarah), maya = await testCookie(env.DB, ids.maya)
  let served = 0, refusal: Response | undefined
  while (!refusal && served < 5_000) {
    const r = await get(sarah)
    if (r.status === 429) refusal = r
    else { assert.equal(r.status, 200); served++ }
  }
  assert.ok(served > 0 && refusal, 'a person is served first, then refused')
  assert.deepEqual(await refusal.json(), { error: 'rate_limited' })
  assert.equal((await get(sarah)).status, 429, 'the refusal holds for the rest of the minute')
  assert.equal((await get(maya)).status, 200, 'another person is counted on their own')
  vi.setSystemTime(minute + 60_000)
  assert.equal((await get(sarah)).status, 200, 'the next minute starts a new count')
})
