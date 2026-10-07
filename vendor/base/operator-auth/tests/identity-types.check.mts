import { createOperatorAuth, type Database, type IdentityAdmission, type VerifiedPrincipal } from '../index.mjs';
import { createOidcClient } from '../oidc/index.mjs';
declare const db: Database;
const auth = createOperatorAuth({ db, config: { origin: 'https://app.example', OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'server-owned-secret', externalIssuers: ['https://idp.example'] }, clientIp: () => '192.0.2.1' });
const admit: IdentityAdmission = auth.createIdentityAdmission({ issuer: 'https://idp.example', subjectEmails: { 'configured-subject': 'owner@example.com' } });
const principal: VerifiedPrincipal = { issuer: 'https://idp.example', subject: 'configured-subject' };
void admit(new Request('https://app.example/auth/callback'), principal, { returnTo: '/app' });
// @ts-expect-error The unassociated seam still requires a true verified-email claim.
void auth.admitVerifiedIdentity(new Request('https://app.example/auth/callback'), principal);
void createOidcClient({ auth, db, config: { origin: 'https://app.example', issuer: 'https://idp.example', redirectUri: 'https://app.example/auth/callback', clientId: 'client', tokenAuthMethod: 'none', transactionSecret: 'server-owned-correlation-secret', subjectEmails: { 'configured-subject': 'owner@example.com' } }, clientIp: () => '192.0.2.1' });
