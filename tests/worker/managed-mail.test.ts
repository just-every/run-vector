import { env } from 'cloudflare:workers'
import { expect, it, vi } from 'vitest'
import { collaborationFixture } from './collaboration-fixture'
import { bindings, request } from './base-auth-fixture'
import { scheduled } from '../../src/core/app/scheduled'

it('[BASE-ACCESS-001 NOTIFY-006] Managed sign-in and assignment mail use Base relay transport and bounded queue recovery', async () => {
  const fixture = await collaborationFixture()
  const remote = { ...bindings, APP_ORIGIN: 'https://vector.example.test', MAIL_MODE: 'production',
    MAIL_PROVIDER: 'rer', MAIL_RELAY_URL: 'https://rer.example.test/api/managed-mail/send',
    MAIL_API_KEY: 'test-only-installation-credential' }
  const network = vi.spyOn(globalThis, 'fetch')
  try {
    network.mockResolvedValueOnce(new Response('{"accepted":true}', { status: 202 }))
    expect((await request('/auth/request', 'POST', { email: bindings.FIRST_OWNER_EMAIL }, '', remote)).status).toBe(202)
    const [url, init] = network.mock.calls[0]
    const wire = JSON.parse(String(init!.body))
    expect(url).toBe(remote.MAIL_RELAY_URL)
    // Base asks for redirect:error; Vector's Workerd fetch boundary implements
    // it using manual mode and refusing 3xx, since Workerd rejects error mode.
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual' })
    expect(new Headers(init!.headers).get('Authorization')).toBe(`Bearer ${remote.MAIL_API_KEY}`)
    expect(new Headers(init!.headers).get('Content-Type')).toBe('application/json')
    expect(wire).toEqual({ to: bindings.FIRST_OWNER_EMAIL, subject: expect.any(String),
      text: expect.any(String), ...(wire.html ? { html: expect.any(String) } : {}) })
    const link = new URL(wire.text.match(/https:\/\/[^\s]+/)[0])
    expect(link.origin + link.pathname).toBe(remote.APP_ORIGIN + '/auth/confirm')
    const confirmed = await request('/auth/confirm', 'POST', { token: link.searchParams.get('token') }, '', remote)
    expect(confirmed.status).toBe(303)
    const cookie = confirmed.headers.get('set-cookie')!.split(';')[0]

    vi.useFakeTimers({ toFake: ['Date'] })
    const clock = new Date()
    network.mockResolvedValueOnce(new Response('{"error":"Limit reached"}', { status: 429, headers: { 'Retry-After': '120' } }))
    const created = await request('/api/issues', 'POST', { title: 'Prepare customer onboarding',
      description: 'Private issue details stay inside Vector', teamId: fixture.initial.teams[0].id,
      assigneeOperatorId: fixture.bob }, cookie, remote)
    expect(created.status, await created.clone().text()).toBe(201)
    const issue = await created.json() as { identifier: string }
    const queued = await env.DB.prepare('SELECT status,attempts,next_attempt_at FROM notification_deliveries WHERE identifier=?')
      .bind(issue.identifier).first<{ status: string; attempts: number; next_attempt_at: string }>()
    expect(queued).toMatchObject({ status: 'retry', attempts: 1 })
    expect(Date.parse(queued!.next_attempt_at)).toBe(clock.getTime() + 120_000)
    const assignment = JSON.parse(String(network.mock.calls[1][1]!.body))
    expect(assignment).toEqual({ to: expect.stringContaining('@collaboration.test'),
      subject: `${issue.identifier}: Prepare customer onboarding`, text: expect.stringContaining(issue.identifier) })
    expect(assignment.text).not.toContain('Private issue details')
    await scheduled({ scheduledTime: clock.getTime() }, remote)
    expect(network).toHaveBeenCalledTimes(2)
    vi.setSystemTime(clock.getTime() + 120_000)
    network.mockResolvedValueOnce(new Response('{"accepted":true}', { status: 202 }))
    await scheduled({ scheduledTime: Date.now() }, remote)
    expect(network).toHaveBeenCalledTimes(3)
    expect(await env.DB.prepare('SELECT status,attempts FROM notification_deliveries WHERE identifier=?')
      .bind(issue.identifier).first()).toEqual({ status: 'accepted', attempts: 2 })
    vi.useRealTimers()

    // Every relay refusal follows the public auth policy: retire the link and
    // show the ordinary mail problem; neither provider payload nor key escapes.
    for (const status of [302, 400, 401, 402, 403, 413, 429, 502, 503]) {
      await env.DB.prepare('DELETE FROM oa_limits').run()
      await env.DB.prepare('DELETE FROM access_rate_limits').run()
      const calls = network.mock.calls.length
      network.mockResolvedValueOnce(new Response('{"error":"relay refusal"}', {
        status, headers: status === 302 ? { Location: 'https://redirect.example.test/forbidden' } : {},
      }))
      const failed = await request('/auth/request', 'POST', { email: bindings.FIRST_OWNER_EMAIL }, '', remote)
      expect(failed.status).toBe(503)
      expect(await failed.json()).toEqual({ error: 'mail_unavailable' })
      expect(network).toHaveBeenCalledTimes(calls + 1)
      expect((await env.DB.prepare('SELECT revoked_at FROM oa_tokens ORDER BY created_at DESC,rowid DESC LIMIT 1').first())?.revoked_at).not.toBeNull()
    }
  } finally {
    vi.useRealTimers()
    network.mockRestore()
  }
})
