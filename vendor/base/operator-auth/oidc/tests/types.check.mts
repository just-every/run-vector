import { createOidcClient, createOidcHandler, type OidcConfig } from '../index.mjs';
import type { OperatorAuth, Database } from '../../index.mjs';
declare const auth: OperatorAuth;
declare const db: Database;
const config: OidcConfig = { origin: 'https://app.example', issuer: 'https://idp.example', redirectUri: 'https://app.example/auth/oidc/callback', clientId: 'client', tokenAuthMethod: 'none', transactionSecret: 'server-only-secret-with-at-least-32-bytes' };
const client = createOidcClient({ auth, db, config, clientIp: request => request.headers.get('CF-Connecting-IP') ?? '' });
const response: Promise<Response | null> = createOidcHandler(client)(new Request('https://app.example/auth/oidc/callback'));
void response;
