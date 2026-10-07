import type { D1Database } from '../../../node_modules/.pnpm/@cloudflare+workers-types@5.20260908.1/node_modules/@cloudflare/workers-types/index.js';
import { createOperatorAuth, type MailSender, type OperatorAuth } from '../index.mjs';
declare const db: D1Database;
declare const sender: MailSender;
const auth: OperatorAuth = createOperatorAuth({ db, mailSender: sender, config: { origin: 'https://example.com', OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'opaque' }, clientIp: () => '192.0.2.1' });
void auth;
