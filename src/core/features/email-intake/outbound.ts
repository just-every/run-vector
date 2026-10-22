import type { WorkerBindings } from '../../app/bindings';
import { hostedMailSender } from '../../platform/mail';
import { createUlid } from '../../shared/ids';
import { addComment } from '../discussion/repository';
import { threadRoot } from '../discussion/threads';
import { SettingsError } from '../settings/repository';
import { automationAudit } from './authority';
import { replyContent } from './files';
import type { Delivery, IntakeMessage, IntakeSettings } from './types';

export async function rootMessage(db: D1Database, issueId: string) {
  return db.prepare(`SELECT * FROM intake_email_messages WHERE issue_id=? AND root_id IS NULL AND status='received' ORDER BY created_at,id LIMIT 1`)
    .bind(issueId).first<IntakeMessage>();
}
export async function replySettings(db: D1Database, teamId: string) {
  const config = await db.prepare('SELECT * FROM team_email_intake WHERE team_id=? AND enabled=1').bind(teamId).first<IntakeSettings>();
  if (!config) throw new SettingsError('email_intake_disabled','This team’s email intake is disabled.',409);
  return config;
}
async function submit(env: WorkerBindings, config: IntakeSettings, root: IntakeMessage, delivery: Delivery, body: string, issue: {id:string;identifier:string}) {
  const sender = env.MAIL_PROVIDER === 'sendgrid' ? hostedMailSender(env) : undefined;
  if (!sender || !root.sender || !root.message_id) throw new SettingsError('email_unconfigured','SendGrid Mail Send must be configured before replying.',409);
  const content = await replyContent(env,issue,body);
  // Re-check the live issue, sender, configuration, actor admission and restore
  // reservation immediately before making the one allowed provider attempt.
  const [admitted] = await env.DB.batch([env.DB.prepare(`SELECT d.id FROM intake_email_deliveries d JOIN issues i ON i.id=d.issue_id
    JOIN team_email_intake e ON e.team_id=i.team_id JOIN intake_email_messages m ON m.id=d.root_id
    WHERE d.id=? AND d.status='processing' AND e.enabled=1 AND e.revision=? AND m.status='received'
      AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
      AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
      AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`).bind(delivery.id,config.revision)]);
  if (!admitted.results.length) throw new SettingsError('reply_no_longer_eligible','Email reply is no longer eligible for delivery.',409);
  let status = 'uncertain', error: string | null = 'submission_uncertain', providerMessageId: string | null = null;
  try {
    const result = await sender.send({deliveryId:delivery.id,from:config.address,to:[root.sender],
      cc:(JSON.parse(root.cc_json) as string[]).filter(address => address !== root.sender && address !== config.address),
      subject:root.subject?.startsWith('Re:') ? root.subject : `Re: ${root.subject ?? ''}`,
      headers:{'Message-ID':delivery.message_id,'In-Reply-To':root.message_id,
        References:[...JSON.parse(root.references_json) as string[],root.message_id].join(' ')},...content});
    status = result.status === 'accepted' ? 'accepted' : result.status === 'uncertain' ? 'uncertain' : 'rejected';
    error = status === 'accepted' ? null : status === 'uncertain' ? 'submission_uncertain' : 'provider_rejected';
    providerMessageId = typeof result.providerMessageId === 'string' ? result.providerMessageId : null;
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'MailValidationError') { status = 'failed'; error = 'invalid_email'; }
  }
  const at = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE intake_email_deliveries SET status=?,error=?,provider_message_id=?,updated_at=? WHERE id=? AND status='processing'`).bind(status,error,providerMessageId,at,delivery.id),
    automationAudit(env.DB,createUlid(new Date()),issue.id,`email_intake.${delivery.kind}.${status}`,at),
  ]);
  return {commentId:delivery.comment_id,status,error};
}

export async function sendEmailReply(env: WorkerBindings, actor: string, issue: {id:string;identifier:string;teamId:string}, input: {body:string;parentId?:string;requestId:string}) {
  const config = await replySettings(env.DB,issue.teamId), root = await rootMessage(env.DB,issue.id);
  if (!root?.message_id || !root.sender) throw new SettingsError('no_email_requester','This issue has no email requester.',409);
  if (env.MAIL_PROVIDER !== 'sendgrid' || !hostedMailSender(env))
    throw new SettingsError('email_unconfigured','SendGrid Mail Send must be configured before replying.',409);
  // Check images before creating a comment or a durable submission claim.
  await replyContent(env,issue,input.body);
  if (input.parentId) await threadRoot(env.DB,issue.id,input.parentId);
  const existing = await env.DB.prepare('SELECT * FROM intake_email_deliveries WHERE issue_id=? AND request_id=?').bind(issue.id,input.requestId).first<Delivery>();
  if (existing) {
    if (!existing.comment_id) throw new SettingsError('reply_processing','This reply is still being recorded. Its request ID will not be sent twice.',409);
    return {commentId:existing.comment_id,status:existing.status,error:existing.error};
  }
  const at = new Date().toISOString(), id = createUlid(new Date());
  const messageId = `<vector-${id}@${config.address.split('@')[1]}>`;
  // The unique request identity and the native comment commit together. A
  // concurrent repeat aborts the complete second native comment transaction.
  let commentId: string;
  try {
    commentId = await addComment(env.DB,issue.id,actor,input.body,input.parentId,(db,commentId) => [
      db.prepare(`INSERT INTO intake_email_deliveries(id,issue_id,comment_id,root_id,request_id,message_id,kind,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'reply','processing',?,?)`)
        .bind(id,issue.id,commentId,root.id,input.requestId,messageId,at,at),
    ]);
  } catch (cause) {
    const duplicate = await env.DB.prepare('SELECT * FROM intake_email_deliveries WHERE issue_id=? AND request_id=?').bind(issue.id,input.requestId).first<Delivery>();
    if (duplicate?.comment_id) return {commentId:duplicate.comment_id,status:duplicate.status,error:duplicate.error};
    throw cause;
  }
  const delivery: Delivery = {id,issue_id:issue.id,comment_id:commentId,root_id:root.id,message_id:messageId,kind:'reply',status:'processing',error:null,created_at:at};
  try { return await submit(env,config,root,delivery,input.body,issue); }
  catch (cause) {
    await env.DB.prepare(`UPDATE intake_email_deliveries SET status='failed',error='delivery_not_submitted',updated_at=? WHERE id=? AND status='processing'`).bind(new Date().toISOString(),id).run();
    if (cause instanceof SettingsError) return {commentId,status:'failed',error:cause.code};
    throw cause;
  }
}

export async function sendAcknowledgement(env: WorkerBindings, config: IntakeSettings, rootId: string, issue: {id:string;identifier:string}) {
  const root = await env.DB.prepare('SELECT * FROM intake_email_messages WHERE id=?').bind(rootId).first<IntakeMessage>();
  if (!root) throw new Error('Email requester unavailable.');
  const at = new Date().toISOString(), id = createUlid(new Date()), messageId = `<vector-${id}@${config.address.split('@')[1]}>`;
  const result = await env.DB.prepare(`INSERT INTO intake_email_deliveries(id,issue_id,root_id,request_id,message_id,kind,status,created_at,updated_at)
    VALUES(?,?,?,'acknowledgement',?,'acknowledgement','processing',?,?) ON CONFLICT(issue_id,request_id) DO NOTHING RETURNING id`)
    .bind(id,issue.id,rootId,messageId,at,at).all();
  if (!result.results.length) return;
  const delivery: Delivery = {id,issue_id:issue.id,comment_id:null,root_id:rootId,message_id:messageId,kind:'acknowledgement',status:'processing',error:null,created_at:at};
  try { await submit(env,config,root,delivery,`Your request was received as ${issue.identifier}.`,issue); }
  catch {
    await env.DB.prepare(`UPDATE intake_email_deliveries SET status='failed',error='acknowledgement_not_submitted',updated_at=? WHERE id=? AND status='processing'`).bind(new Date().toISOString(),id).run();
  }
}
