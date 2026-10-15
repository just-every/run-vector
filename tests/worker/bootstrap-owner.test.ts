import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { expect, inject, it } from 'vitest';
import { bindings, request } from './base-auth-fixture';

it('the setup token claims one native owner without mail, projects the workspace and cannot bypass signed owner admission', async () => {
  await applyD1Migrations(env.DB, inject('migrations'));
  const config = {
    APP_ORIGIN: 'https://bootstrap.vector.test',
    SETUP_TOKEN: 'test-only-bootstrap-token-at-least-32-bytes',
    MAIL_MODE: 'production',
    MAIL_PROVIDER: 'sendgrid',
    MAIL_API_KEY: undefined,
    RER_DEV_KEY: undefined,
  };
  const post = (token: string, extra = {}) => request('/auth/bootstrap', 'POST', {
    token, displayName: 'Installation owner', returnTo: '/app',
  }, '', { ...config, ...extra });
  const owners = () => env.DB.prepare('SELECT count(*) AS n FROM oa_operators').first('n');
  expect((await request('/health', 'GET', undefined, '', config)).status).toBe(200);
  expect(await owners()).toBe(0);
  expect((await post('test-only-wrong-token')).status).toBe(403);
  expect(await owners()).toBe(0);
  // Even partial signed-claim configuration must close the setup-token door.
  const managed = await post(config.SETUP_TOKEN, {
    RER_OWNER_CLAIM_ISSUER: 'https://management.example.test',
  });
  expect(managed.status).toBe(403);
  expect(await owners()).toBe(0);
  const claimed = await post(config.SETUP_TOKEN);
  expect(claimed.status).toBe(303);
  expect(claimed.headers.get('location')).toBe('/setup');
  expect(claimed.headers.get('set-cookie')).toContain('; Secure');
  const cookie = claimed.headers.get('set-cookie')!.split(';')[0];
  const session = await request('/api/session', 'GET', undefined, cookie, config);
  expect(session.status).toBe(200);
  const identity = await session.json() as { operatorId: string };
  expect(identity.operatorId).toBeTruthy();
  const setup = await request('/api/setup', 'GET', undefined, cookie, config);
  expect(setup.status).toBe(200);
  expect(await setup.json()).toMatchObject({ owner: true, completed: false, workspace: bindings.WORKSPACE_NAME });
  expect((await request('/api/current', 'GET', undefined, cookie, config)).status).toBe(200);
  const repeated = await post(config.SETUP_TOKEN);
  expect(repeated.status).toBe(409);
  expect(await repeated.json()).toEqual({ error: 'already_initialized' });
  expect(await owners()).toBe(1);
  expect(await env.DB.prepare('SELECT count(*) AS n FROM oa_sessions').first('n')).toBe(1);
  expect(await env.DB.prepare('SELECT count(*) AS n FROM rer_mail_development_outbox').first('n')).toBe(0);
});
