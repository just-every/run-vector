import { sealSecret } from '../integrations/secrets';
import { eventKeyIdentity } from './events';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { createUlid } from '../../shared/ids';
import { requireIssueAccess, IssueAccessError } from '../issues/access';
import { requireIssueProjection } from '../issues/projection-access';
import { ThreadError } from '../discussion/threads';
import { settingsActor, SettingsError } from '../settings/repository';
import { idSchema, requireTeamSettings, settingsSchema } from './authority';
import { rootMessage, sendEmailReply } from './outbound';
import type { IntakeMessage, IntakeSettings } from './types';

const identifierSchema = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
const replySchema = z.object({body:z.string().trim().min(1).max(100000),parentId:idSchema.optional(),requestId:idSchema}).strict();
type Handler = (c: Context<AppEnvironment>) => Promise<Response>;
function door(handler: Handler): Handler {
  return async c => {
    try { return await handler(c); }
    catch (error) {
      if (error instanceof z.ZodError) return c.json({error:'invalid_request',issues:error.issues},400);
      if (error instanceof SettingsError || error instanceof IssueAccessError || error instanceof ThreadError)
        return c.json({error:error.code,message:error.message},error.status);
      throw error;
    }
  };
}
async function teamProjection(c: Context<AppEnvironment>, teamId: string) {
  await requireTeamSettings(c.env.DB,c.get('operatorId'),teamId);
  const row = await c.env.DB.prepare('SELECT * FROM team_email_intake WHERE team_id=?').bind(teamId).first<IntakeSettings>();
  const receipts = await c.env.DB.prepare(`SELECT m.id,COALESCE(m.message_id,'') AS messageId,m.status,m.error,i.identifier AS issueIdentifier,m.created_at AS createdAt
    FROM intake_email_messages m LEFT JOIN issues i ON i.id=m.issue_id WHERE m.team_id=? AND m.status<>'erased' ORDER BY m.created_at DESC,m.id DESC LIMIT 50`)
    .bind(teamId).all();
  await requireTeamSettings(c.env.DB,c.get('operatorId'),teamId);
  const configured = await c.env.DB.prepare("SELECT 1 FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind(eventKeyIdentity(teamId)).first();
  return {eventsConfigured:!!configured,settings:{enabled:row?.enabled === 1,address:row?.address ?? '',allowedSenders:row ? JSON.parse(row.allowed_senders_json) as string[] : [],acknowledgement:row?.acknowledgement === 1},
    receipts:receipts.results,provider:'cloudflare' as const,ingressConfigured:false,customerMappingAvailable:false as const};
}
export function addEmailIntakeRoutes(app: Hono<AppEnvironment>) {
  app.get('/settings/teams/:teamId/email-intake',door(async c => {
    const teamId = idSchema.parse(c.req.param('teamId'));
    return c.json(await teamProjection(c,teamId));
  }));
  app.put('/settings/teams/:teamId/email-intake',door(async c => {
    const teamId = idSchema.parse(c.req.param('teamId'));
    await requireTeamSettings(c.env.DB,c.get('operatorId'),teamId);
    const input = settingsSchema.parse(await readRequestJson(c.req.raw));
    const conflict = await c.env.DB.prepare('SELECT team_id FROM team_email_intake WHERE address=? AND team_id<>?').bind(input.address,teamId).first();
    if (conflict) throw new SettingsError('address_in_use','Another team uses this email address.',409);
    const at = new Date().toISOString();
    const identity = eventKeyIdentity(teamId);
    const encrypted = input.eventVerificationKey ? await sealSecret(c.env,identity,input.eventVerificationKey) : null;
    await c.env.DB.batch([
      ...(encrypted ? [c.env.DB.prepare("INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted").bind(identity,encrypted)] : []),
      c.env.DB.prepare(`INSERT INTO team_email_intake(team_id,enabled,address,allowed_senders_json,acknowledgement,actor_operator_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(team_id) DO UPDATE SET enabled=excluded.enabled,address=excluded.address,allowed_senders_json=excluded.allowed_senders_json,
        acknowledgement=excluded.acknowledgement,actor_operator_id=excluded.actor_operator_id,revision=team_email_intake.revision+1,updated_at=excluded.updated_at`)
        .bind(teamId,Number(input.enabled),input.address,JSON.stringify(input.allowedSenders),Number(input.acknowledgement),c.get('operatorId'),at,at),
      c.env.DB.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
        VALUES(?,?,'team.email_intake.updated',?,?,?,?)`).bind(createUlid(new Date()),c.get('operatorId'),teamId,teamId,at,at),
    ]);
    return c.json(await teamProjection(c,teamId));
  }));
  app.get('/issues/:identifier/email-intake',door(async c => {
    const identifier = identifierSchema.parse(c.req.param('identifier'));
    const issue = await requireIssueProjection(c,identifier), person = await settingsActor(c.env.DB,c.get('operatorId'));
    const root = await rootMessage(c.env.DB,issue.id);
    const rows = await c.env.DB.prepare(`SELECT * FROM intake_email_messages WHERE issue_id=? AND status NOT IN('erased','quarantined') ORDER BY created_at,id`).bind(issue.id).all<IntakeMessage>();
    const files = await c.env.DB.prepare(`SELECT e.message_id AS messageId,f.id AS fileId,e.content_id AS contentId,f.name AS filename,f.content_type AS contentType
      FROM intake_email_files e JOIN issue_files f ON f.id=e.file_id WHERE f.issue_id=? AND f.deleted_at IS NULL AND f.state='ready'`).bind(issue.id).all<{messageId:string;fileId:string;contentId:string|null;filename:string;contentType:string}>();
    const deliveries = await c.env.DB.prepare(`SELECT comment_id AS commentId,kind,CASE WHEN bounced_at IS NOT NULL THEN 'bounced' ELSE status END AS status,error,created_at AS createdAt FROM intake_email_deliveries WHERE issue_id=? ORDER BY created_at,id`).bind(issue.id).all();
    await requireIssueProjection(c,identifier);
    return c.json({thread:root && {requester:root.sender!,requesterDomain:root.requester_domain!,subject:root.subject ?? '',cc:JSON.parse(root.cc_json) as string[],messageId:root.message_id!},
      canReply:person.role !== 'guest' && !!root,deliveries:deliveries.results,
      messages:rows.results.map(row => ({id:row.id,commentId:row.comment_id,sender:row.sender ?? '',subject:row.subject ?? '',text:row.text_body ?? row.html_body ?? '',html:row.html_body,
        attachments:files.results.filter(file => file.messageId === row.id).map(({messageId:_,...file}) => file),createdAt:row.created_at})),customerMappingAvailable:false});
  }));
  app.post('/issues/:identifier/email-replies',door(async c => {
    const identifier = identifierSchema.parse(c.req.param('identifier'));
    const person = await settingsActor(c.env.DB,c.get('operatorId'));
    if (person.role === 'guest') throw new SettingsError('forbidden','Guests cannot reply by email.',403);
    const issue = await requireIssueAccess(c.env.DB,identifier,c.get('operatorId'));
    const row = await c.env.DB.prepare('SELECT team_id AS teamId FROM issues WHERE id=?').bind(issue.id).first<{teamId:string}>();
    if (!row) throw new SettingsError('not_found','This issue is unavailable.',404);
    const input = replySchema.parse(await readRequestJson(c.req.raw));
    return c.json(await sendEmailReply(c.env,c.get('operatorId'),{...issue,...row},input),201);
  }));
}
