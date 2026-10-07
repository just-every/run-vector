// Only tests import this signed IdP wire fixture and request envelope. The core,
// OIDC handler, protocol checks, WebCrypto and D1 execute their production code.
import { createOperatorAuth, createAuthHandler } from '../../index.mjs';
import { createOidcClient, createOidcHandler } from '../index.mjs';
import { random, digest } from '../crypto.mjs';
import { sign } from './idp.mjs';

export default {
  async fetch(envelope, env) {
    const { url, ...init } = await envelope.json(); const request = new Request(url, init);
    const entries = JSON.parse(env.TEST_PROVIDERS); const key = JSON.parse(env.TEST_KEY);
    const path = new URL(url).pathname;
    const auth = createOperatorAuth({ db: env.DB, config: { origin: 'https://app.example', OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'only-for-tests-binding-session-secret', SETUP_TOKEN: 'only-for-tests-binding-setup-secret', externalIssuers: entries.map(p => p.issuer), ...JSON.parse(env.TEST_CORE) }, clientIp: () => '192.0.2.1' });
    if (path === '/__grant') {
      const { location, claims } = await request.json(); const uri = new URL(location); const p = uri.searchParams;
      const index = entries.findIndex(e => e.issuer + '/authorize' === uri.origin + uri.pathname);
      if (index < 0 || p.get('response_type') !== 'code' || p.get('code_challenge_method') !== 'S256' || p.get('client_id') !== 'fixture-client' || p.get('redirect_uri') !== `https://app.example/auth/oidc/${index}/callback`) throw new Error('Invalid fixture authorization request');
      const code = random();
      await env.DB.prepare('INSERT INTO fixture_grants(code,payload) VALUES(?,?)').bind(code, JSON.stringify({ index, authorization: Object.fromEntries(p), claims })).run();
      return Response.json({ code });
    }
    for (const [index, entry] of entries.entries()) {
      const fetcher = async (uri, init = {}) => {
        if (uri === entry.issuer + '/.well-known/openid-configuration') return Response.json({ issuer: entry.issuer, authorization_endpoint: entry.issuer + '/authorize', token_endpoint: entry.issuer + '/token', jwks_uri: entry.issuer + '/jwks', response_types_supported: ['code'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_basic'], code_challenge_methods_supported: ['S256'] });
        if (uri === entry.issuer + '/jwks') return Response.json({ keys: [key.public] });
        if (uri !== entry.issuer + '/token' || init.method !== 'POST' || init.redirect !== 'error') throw new Error('Invalid fixture token request');
        const form = new URLSearchParams(init.body);
        const row = await env.DB.prepare('DELETE FROM fixture_grants WHERE code=? RETURNING payload').bind(form.get('code')).first();
        const grant = row && JSON.parse(row.payload);
        if (!grant || grant.index !== index || form.get('grant_type') !== 'authorization_code' || form.get('client_id') !== grant.authorization.client_id || form.get('redirect_uri') !== grant.authorization.redirect_uri || await digest(form.get('code_verifier')) !== grant.authorization.code_challenge || init.headers.Authorization !== `Basic ${btoa('fixture-client:fixture-secret')}`) return Response.json({ error: 'invalid_grant' }, { status: 400 });
        const now = Math.floor(Date.now() / 1000);
        const claims = { iss: entry.issuer, sub: 'subject-a', aud: 'fixture-client', iat: now, exp: now + 300, nonce: grant.authorization.nonce, email: 'owner@example.com', email_verified: true, ...grant.claims };
        return Response.json({ access_token: random(), token_type: 'Bearer', id_token: await sign(key, claims) });
      };
      const client = createOidcClient({ auth, db: env.DB, fetch: fetcher, clientIp: () => '192.0.2.1', config: { origin: 'https://app.example', issuer: entry.issuer, clientId: 'fixture-client', clientSecret: 'fixture-secret', transactionSecret: 'only-for-tests-binding-correlation-secret', startPath: `/auth/oidc/${index}/start`, redirectUri: `https://app.example/auth/oidc/${index}/callback`, subjectEmails: entry.subjectEmails } });
      const response = await createOidcHandler(client)(request); if (response) return response;
    }
    if (path === '/private') {
      const session = await auth.getSession(request);
      return Response.json(session ? { kind: session.kind, email: session.operator.email, role: session.operator.role, id: session.operator.id } : { error: 'unauthenticated' }, { status: session ? 200 : 401 });
    }
    return await createAuthHandler(auth)(request) ?? new Response('Not found', { status: 404 });
  },
};
