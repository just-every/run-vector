import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { beforeAll, expect, inject, it } from 'vitest'
import { bindings, request, signIn } from './base-auth-fixture'

beforeAll(async () => applyD1Migrations(env.DB, inject('migrations')))

it('the anonymous Lobby changes its action only after the owner confirms setup', async () => {
  const state = async () => {
    const response = await request('/setup/state')
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
    return response.json()
  }
  expect(await state()).toEqual({ state: 'unclaimed' })
  const initial = await request('/', 'GET', undefined, '', { WORKSPACE_NAME: undefined })
  expect(initial.status).toBe(200)
  expect(initial.headers.get('set-cookie')).toBeNull()
  expect(await initial.text()).toContain('href="/setup"')
  const owner = await signIn()
  expect(await state()).toEqual({ state: 'unclaimed' })
  expect((await request('/api/setup/complete', 'POST', { confirmed: false }, owner)).status).toBe(400)
  expect(await state()).toEqual({ state: 'unclaimed' })
  expect((await request('/api/setup/complete', 'POST', { confirmed: true }, owner)).status).toBe(200)
  expect(await state()).toEqual({ state: 'claimed' })
  const claimed = await request('/')
  expect(claimed.status).toBe(200)
  expect(claimed.headers.get('set-cookie')).toBeNull()
  const html = await claimed.text()
  expect(html).toContain('href="/signin"')
  expect(html).toContain(bindings.WORKSPACE_NAME)
  const missingName = await request('/', 'GET', undefined, '', { WORKSPACE_NAME: undefined })
  expect(missingName.status).toBe(503)
  expect(await missingName.json()).toMatchObject({ error: 'configuration_missing' })
})
