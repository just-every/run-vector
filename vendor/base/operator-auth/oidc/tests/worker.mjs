// Test-only workerd envelope + cryptographic IdP fixture; no external network.
import { createOperatorAuth, createAuthHandler } from '../../index.mjs';
import { createOidcClient, createOidcHandler } from '../index.mjs';
import { idp } from './idp.mjs';
export default {
  async fetch(envelope, env) {
    const { url, ...init } = await envelope.json(); const request = new Request(url, init);
    const db = env.DB;
    const auth = createOperatorAuth({ db, config: { origin: 'https://app.example', OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'only-for-tests-real-core-session-secret', SETUP_TOKEN: 'only-for-tests-real-core-setup-secret', externalIssuers: ['https://idp.example'] }, clientIp: () => '192.0.2.1' });
    const provider = idp(JSON.parse(env.TEST_KEY));
    const path = new URL(url).pathname;
    if (path === '/__grant') {
      const { location } = await request.json(); const code = provider.grant(location);
      await db.prepare('INSERT INTO fixture_grants(code,payload) VALUES(?,?)').bind(code, JSON.stringify(provider.grants.get(code))).run();
      return Response.json({ code });
    }
    const fetcher = async (uri, init) => {
      if (uri.endsWith('/token')) {
        const code = new URLSearchParams(init.body).get('code');
        const row = await db.prepare('DELETE FROM fixture_grants WHERE code=? RETURNING payload').bind(code).first();
        if (row) provider.grants.set(code, JSON.parse(row.payload));
      }
      return provider.fetch(uri, init);
    };
    const client = createOidcClient({ auth, db, clientIp: () => '192.0.2.1', fetch: fetcher,
      config: { origin: 'https://app.example', issuer: 'https://idp.example', redirectUri: 'https://app.example/auth/oidc/callback', clientId: 'client', clientSecret: 'fixture-secret', transactionSecret: 'only-for-tests-independent-correlation-secret' } });
    if (path === '/private') { const session = await auth.getSession(request); return Response.json(session ? { kind: session.kind, email: session.operator.email } : { error: 'unauthenticated' }, { status: session ? 200 : 401 }); }
    return await createOidcHandler(client)(request) ?? await createAuthHandler(auth)(request) ?? new Response('Not found', { status: 404 });
  },
};
