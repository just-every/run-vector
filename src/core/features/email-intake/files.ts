import type { WorkerBindings } from '../../app/bindings';
import { createUlid } from '../../shared/ids';
import { addFile, failFile, finalizeFile } from '../discussion/repository';
import { fileSettlementDatabase } from '../auth/mutation-database';
import { SettingsError } from '../settings/repository';
import type { InboundMail } from './types';

export const inboundLimits = {
  maxRawBytes: 40 * 1024 * 1024, maxBodyBytes: 100000, maxAttachments: 20,
  maxAttachmentBytes: 26214400, maxTotalAttachmentBytes: 26214400,
};
const mimeTypes = new Set(['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/csv','application/json','application/zip']);
export function validateInboundFiles(mail: InboundMail) {
  for (const file of mail.attachments) {
    if (!mimeTypes.has(file.contentType) || !file.content.length || file.filename.length > 255 || /[\x00-\x1f\x7f]/.test(file.filename))
      throw new SettingsError('invalid_attachment', 'Email attachment exceeds the supported file limits.', 400);
  }
}
export async function digest(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
export async function saveInboundFiles(env: WorkerBindings, actor: string, issue: {id:string;identifier:string}, messageId: string, mail: InboundMail) {
  for (const [index,file] of mail.attachments.entries()) {
    const id = createUlid(new Date()), key = `issues/${issue.id}/${id}`, sha256 = await digest(file.content);
    const name = file.filename || `attachment-${index + 1}`;
    if (!await addFile(env.DB, issue, actor, {id, name, contentType:file.contentType, bytes:file.content.length, key, sha256}))
      throw new SettingsError('storage_limit', 'The workspace attachment limit was reached.', 409);
    const settlement = fileSettlementDatabase(env.DB);
    let stored = false;
    try {
      await env.FILES.put(key, file.content, {httpMetadata:{contentType:file.contentType},customMetadata:{operationId:id,sha256}});
      stored = true;
      if (!await finalizeFile(settlement, issue.id, id, actor))
        throw new SettingsError('file_unavailable', 'The attachment was removed during receipt.', 409);
      await env.DB.prepare('INSERT INTO intake_email_files(message_id,file_id,content_id) VALUES(?,?,?)').bind(messageId,id,file.contentId).run();
    } catch (error) {
      await failFile(settlement,id,stored);
      throw error;
    }
  }
}

function escapeHtml(value: string) {
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}
/** Only explicit local issue image references can become outbound bytes. Never
 * fetch a URL named by a comment or send a private authenticated file link. */
export async function replyContent(env: WorkerBindings, issue: {id:string;identifier:string}, body: string) {
  const attachments: {filename:string;contentType:string;content:Uint8Array;contentId:string;disposition:'inline'}[] = [];
  let html = '', end = 0, total = 0;
  for (const match of body.matchAll(/!\[([^\]]*)\]\(([^\s)]+)\)/g)) {
    const url = new URL(match[2],env.APP_ORIGIN);
    const fileMatch = /^\/api\/issues\/([A-Z]{2,10}-[1-9][0-9]*)\/files\/([0-7][0-9A-HJKMNP-TV-Z]{25})$/.exec(url.pathname);
    if (url.origin !== env.APP_ORIGIN || !fileMatch || fileMatch[1] !== issue.identifier || url.search || url.hash)
      throw new SettingsError('invalid_reply_image', 'Email reply images must be files attached to this issue.', 400);
    const file = await env.DB.prepare(`SELECT name,content_type AS contentType,blob_key AS key,bytes FROM issue_files WHERE id=? AND issue_id=? AND state='ready' AND deleted_at IS NULL AND removal_requested_at IS NULL`)
      .bind(fileMatch[2],issue.id).first<{name:string;contentType:string;key:string;bytes:number}>();
    if (!file || !file.contentType.startsWith('image/')) throw new SettingsError('invalid_reply_image', 'The reply image is unavailable.', 400);
    total += file.bytes;
    if (total > inboundLimits.maxTotalAttachmentBytes || attachments.length >= inboundLimits.maxAttachments)
      throw new SettingsError('reply_attachment_limit', 'The email reply exceeds attachment limits.', 400);
    const object = await env.FILES.get(file.key);
    if (!object) throw new SettingsError('reply_image_missing', 'The reply image could not be read.', 409);
    const content = new Uint8Array(await object.arrayBuffer());
    if (content.length !== file.bytes) throw new SettingsError('reply_image_missing', 'The reply image is incomplete.', 409);
    const contentId = `vector-${fileMatch[2]}-${attachments.length}`;
    attachments.push({filename:file.name,contentType:file.contentType,content,contentId,disposition:'inline'});
    html += escapeHtml(body.slice(end,match.index)) + `<img src="cid:${contentId}" alt="${escapeHtml(match[1])}">`;
    end = match.index! + match[0].length;
  }
  html += escapeHtml(body.slice(end));
  return {text:body,html:html.replaceAll('\n','<br>'),attachments};
}
