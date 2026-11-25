import { env } from 'cloudflare:workers';
import { createHash, randomBytes } from 'node:crypto';
import { applyD1Migrations } from 'cloudflare:test';
import { expect, inject, it } from 'vitest';
import { bindings, request } from './base-auth-fixture';

it('claims and admits a hosted owner with mail off and refuses email requests', async () => {
  await applyD1Migrations(env.DB, inject('migrations'));
  const config = {
    APP_ORIGIN: 'https://mail-off.vector.test',
    SETUP_TOKEN: 'test-only-bootstrap-token-at-least-32-bytes',
    MAIL_MODE: 'production',
    MAIL_PROVIDER: 'none',
    MAIL_FROM: undefined,
    MAIL_API_KEY: undefined,
    RER_DEV_KEY: undefined,
  };
  const open = (path: string, method = 'GET', body?: unknown, cookie = '') => request(path, method, body, cookie, config);

  expect((await open('/health')).status).toBe(200);
  expect((await open('/auth/bootstrap', 'POST', { token: config.SETUP_TOKEN, displayName: 'Installation owner' })).status).toBe(303);
  const emailRequest = await open('/auth/request', 'POST', { email: bindings.FIRST_OWNER_EMAIL });
  expect(emailRequest.status).toBe(503);
  expect(await emailRequest.json()).toEqual({ error: 'mail_off' });

  // Stand in for the Cloudflare D1 write by `rer signin`. Both browser
  // requests below go through the same production routes as its link.
  const token = randomBytes(32).toString('base64url');
  const digest = createHash('sha256').update(`owner-signin\0${token}`).digest('hex');
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO oa_owner_signins (id,token_hash,operator_id,operator_version,created_at,expires_at)
    SELECT ?,?,id,version,?,? FROM oa_operators WHERE email=?`).bind(crypto.randomUUID(), digest, now, now + 60_000, bindings.FIRST_OWNER_EMAIL!).run();
  expect((await open('/auth/owner-signin?token=' + token)).status).toBe(200);
  const session = await open('/auth/owner-signin', 'POST', { token });
  expect(session.status).toBe(303);
  expect(session.headers.get('location')).toBe('/setup');
  const cookie = session.headers.get('set-cookie')!.split(';')[0];
  expect(await (await open('/auth/session', 'GET', undefined, cookie)).json()).toMatchObject({
    kind: 'native', operator: { email: bindings.FIRST_OWNER_EMAIL },
  });
  expect((await open('/auth/owner-signin', 'POST', { token })).status).toBe(400);

  const invite = await open('/api/settings/operators/invite', 'POST', { email: 'new@base.test', displayName: 'New teammate' }, cookie);
  expect(invite.status).toBe(503);
  expect(await invite.json()).toMatchObject({ error: 'mail_off' });
  expect(await env.DB.prepare('SELECT count(*) AS n FROM rer_mail_development_outbox').first('n')).toBe(0);
});
