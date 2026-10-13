import {env} from 'cloudflare:workers'
import {applyD1Migrations} from 'cloudflare:test'
import {beforeEach,expect,inject,it} from 'vitest'
import {bindings,origin,request,mailToken,confirm} from '../worker/base-auth-fixture'
import {developmentOutboxResponse,developmentSender} from '../../src/core/features/auth/development.server'
import {bootstrapWorkspace} from '../../src/core/features/bootstrap/repository'
import {createD1DevelopmentOutbox} from '../../vendor/base/mail/src/development/index.mjs'
beforeEach(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await bootstrapWorkspace(env.DB,bindings);for(const table of ['oa_sessions','oa_tokens','rer_mail_development_outbox','oa_limits','access_rate_limits'])await env.DB.prepare(`DELETE FROM ${table}`).run()})
it('[BASE-ACCESS-001 BASE-ACCESS-004] shared outbox requires explicit exact loopback and a secret; GET never consumes a link',async()=>{
 expect((await request('/auth/request','POST',{email:bindings.FIRST_OWNER_EMAIL})).status).toBe(202)
 const token=await mailToken(bindings.FIRST_OWNER_EMAIL!),before=(await env.DB.prepare('SELECT * FROM oa_tokens').all()).results
 for(const headers of [{host:new URL(origin).host},{host:new URL(origin).host,origin},{host:new URL(origin).host,origin:'https://hostile.test'},{host:'wrong.test'}]){
  const response=await developmentOutboxResponse(bindings,new Request(origin+'/__dev/outbox',{headers:{...headers,'x-rer-dev-key':bindings.RER_DEV_KEY!}}));expect(response?.status??404).toBe(headers.host==='wrong.test'||headers.origin==='https://hostile.test'?404:200)
 }
 expect((await developmentOutboxResponse(bindings,new Request(origin+'/__dev/outbox',{headers:{host:new URL(origin).host}})))?.status).toBe(404)
 for(const override of [{MAIL_MODE:'production'},{SESSION_SECRET:''},{APP_ORIGIN:'https://vector.test'},{APP_ORIGIN:'https://hosted.example.test'}]){
  expect(await developmentOutboxResponse({...bindings,...override},new Request(origin+'/__dev/outbox',{headers:{host:new URL(origin).host}}))).toBeNull()
 }
 expect(()=>developmentSender({...bindings,APP_ORIGIN:'https://vector.test'})).toThrow()
 expect((await request('/__dev/outbox','POST',{})).status).toBe(404)
 expect((await developmentOutboxResponse(bindings,new Request(origin+'/__dev/outbox',{method:'POST',headers:{host:new URL(origin).host,'x-rer-dev-key':bindings.RER_DEV_KEY!}})))?.status).toBe(405)
 expect((await request('/auth/confirm?token='+token)).status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM oa_tokens').all()).results).toEqual(before)
 expect(await env.DB.prepare('SELECT count(*) n FROM oa_sessions').first('n')).toBe(0)
 const cookie=await confirm(token);expect((await request('/api/session','GET',undefined,cookie)).status).toBe(200)
})
it('[BASE-ACCESS-001 BASE-ACCESS-004] revoked auth intent cannot be reinserted through actual Base D1 outbox',async()=>{
 expect((await request('/auth/request','POST',{email:bindings.FIRST_OWNER_EMAIL})).status).toBe(202)
 const row=(await env.DB.prepare('SELECT id,message FROM rer_mail_development_outbox').first<{id:string,message:string}>())!
 const message=JSON.parse(row.message),tokenId=message.deliveryId
 await env.DB.prepare('UPDATE oa_tokens SET revoked_at=? WHERE id=?').bind(Date.now(),tokenId).run()
 expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first('n')).toBe(0)
 const outbox=createD1DevelopmentOutbox({db:env.DB});await outbox.put(message)
 expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first('n')).toBe(0)
 // Guard sensitivity: without the admission trigger the same real insert succeeds.
 const guard=(await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='vector_development_capture'").first<string>('sql'))!
 try {await env.DB.prepare('DROP TRIGGER vector_development_capture').run();await outbox.put(message);expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first('n')).toBe(1)}
 finally {await env.DB.prepare(guard).run();await env.DB.prepare('DELETE FROM rer_mail_development_outbox').run()}
})
it('[NOTIFY-006 BASE-DATA-003] erasure prevents a late notification capture from restoring recipient or actor data',async()=>{
 const {collaborationFixture}=await import('../worker/collaboration-fixture'),{drainNotificationMail}=await import('../../src/core/features/notifications/mail')
 const f=await collaborationFixture();await f.pending({title:'Private erased recipient'});await drainNotificationMail(bindings)
 const before=(await env.DB.prepare("SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN(SELECT id FROM notification_deliveries WHERE recipient_id=?)").bind(f.bob).first<{message:string}>())!
 expect(before).not.toBeNull();const message=JSON.parse(before.message)
 expect((await f.call('/settings/operators/'+f.bob,'DELETE')).status).toBe(200)
 await createD1DevelopmentOutbox({db:env.DB}).put(message)
 expect(await env.DB.prepare("SELECT count(*) n FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").bind(message.deliveryId).first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM notification_deliveries WHERE id=?').bind(message.deliveryId).first('n')).toBe(0)
});
