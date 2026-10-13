import { env } from 'cloudflare:workers'
// @ts-expect-error Base crypto is native ESM.
import { opaqueToken, hashToken } from '../../vendor/base/operator-auth/crypto.mjs'
import { testCookie, testSecret } from './native-fixture'
import { createUlid } from '../../src/core/shared/ids'

/** Only the old schema is populated here. Current mail capture requires 0020. */
export async function historicalAuth(ownerEmail:string) {
 const now=Date.now(),iso=new Date(now).toISOString();
 const owner=(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(ownerEmail).first<{id:string}>())!;
 const cookie=await testCookie(env.DB,owner.id);
 async function invite(email:string,accepted=false) {
  const id=createUlid(new Date()),token=opaqueToken(),linkId=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,?,?,'owner',?,?)").bind(id,email,email.split('@')[0],accepted?'active':'invited',now).run();
  await env.DB.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at,consumed_at) SELECT ?,?,'invite',?,1,id,version,'/app',?,?,? FROM oa_operators WHERE id=?")
   .bind(linkId,await hashToken(testSecret,'link',token),id,now,now+600000,accepted?now:null,owner.id).run();
  await env.DB.prepare('INSERT INTO local_mail_outbox VALUES(?,?,?,?,?)').bind(linkId,email,'http://127.0.0.1:15920/auth/confirm?token='+token,iso,iso).run();
  if(!accepted)return {token,cookie:''};
  const workspace=(await env.DB.prepare('SELECT id FROM workspace_settings LIMIT 1').first<{id:string}>())!;
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,workspace.id,email.split('@')[0],email,iso,iso).run();
  return {token,cookie:await testCookie(env.DB,id)};
 }
 return {cookie,invite};
}

export async function legacyCookie(operatorId:string) {
 const token=opaqueToken(),now=new Date().toISOString();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
 await env.DB.prepare('INSERT INTO operator_sessions VALUES(?,?,?,?,NULL,?,?)').bind(crypto.randomUUID(),operatorId,hash,new Date(Date.now()+86400000).toISOString(),now,now).run();
 return 'vector_session='+token;
}
