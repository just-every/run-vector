// Test-only cryptographic IdP and wire transport. Product code never imports this.
import { digest, encode, utf8, random } from '../crypto.mjs';
export async function keys(alg = 'RS256') {
  const algorithm = alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: 'P-256' };
  const pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  return { public: { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: random(), alg, use: 'sig' }, private: await crypto.subtle.exportKey('jwk', pair.privateKey) };
}
export async function sign(key, claims, header = {}) {
  const algorithm = key.public.alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
  const privateKey = await crypto.subtle.importKey('jwk', key.private, algorithm, false, ['sign']);
  const input = `${encode(utf8.encode(JSON.stringify({ alg: key.public.alg, kid: key.public.kid, typ: 'JWT', ...header })))}.${encode(utf8.encode(JSON.stringify(claims)))}`;
  return `${input}.${encode(await crypto.subtle.sign(algorithm, privateKey, utf8.encode(input)))}`;
}
export function idp(key, options = {}) {
  const grants = new Map(); const requests = [];
  const metadata = { issuer: 'https://idp.example', authorization_endpoint: 'https://idp.example/authorize', token_endpoint: 'https://idp.example/token', jwks_uri: 'https://idp.example/jwks', response_types_supported: ['code'], id_token_signing_alg_values_supported: [key.public.alg], token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'], code_challenge_methods_supported: ['S256'], ...options.metadata };
  return {
    requests, grants, metadata,
    grant(location) {
      const url = new URL(location); const p = url.searchParams;
      if (url.origin + url.pathname !== metadata.authorization_endpoint || p.get('response_type') !== 'code' || p.get('code_challenge_method') !== 'S256' || p.get('redirect_uri') !== 'https://app.example/auth/oidc/callback' || p.get('client_id') !== 'client') throw new Error('Bad authorization request');
      const code = random(); grants.set(code, Object.fromEntries(p)); return code;
    },
    async fetch(uri, init = {}) {
      requests.push({ uri, method: init.method, redirect: init.redirect });
      if (options.transport) { const response = await options.transport(uri, init); if (response) return response; }
      if (uri.endsWith('/.well-known/openid-configuration')) return Response.json(metadata);
      if (uri === metadata.jwks_uri) return Response.json({ keys: options.jwks ?? [key.public] });
      if (uri !== metadata.token_endpoint || init.method !== 'POST' || init.redirect !== 'error') throw new Error('Bad token request');
      const form = new URLSearchParams(init.body); const code = form.get('code'); const grant = grants.get(code); grants.delete(code);
      if (!grant || form.get('grant_type') !== 'authorization_code' || form.get('client_id') !== grant.client_id || form.get('redirect_uri') !== grant.redirect_uri || await digest(form.get('code_verifier')) !== grant.code_challenge) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      const method = options.method ?? 'client_secret_basic';
      if (method === 'client_secret_basic' && init.headers.Authorization !== `Basic ${btoa('client:fixture-secret')}` || method === 'client_secret_post' && form.get('client_secret') !== 'fixture-secret' || method === 'none' && (form.has('client_secret') || init.headers.Authorization)) return Response.json({ error: 'invalid_client' }, { status: 401 });
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: metadata.issuer, sub: 'operator-subject', aud: 'client', iat: now, exp: now + 300, nonce: grant.nonce, email: 'owner@example.com', email_verified: true, ...options.claims };
      if (options.claims?.nonce === '$other') claims.nonce = random();
      let token = await sign(options.signingKey ?? key, claims, options.header);
      if (options.corruptSignature) token = token.slice(0, -8) + 'AAAAAAAA';
      return Response.json({ access_token: random(), token_type: 'Bearer', id_token: token, ...options.token });
    },
  };
}
