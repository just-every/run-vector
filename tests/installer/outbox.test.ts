import {env} from 'cloudflare:workers'
import {applyD1Migrations} from 'cloudflare:test'
import {beforeEach,expect,inject,it} from 'vitest'
import {bindings,origin,request,mailToken,confirm} from '../worker/base-auth-fixture'
import {developmentKeyResponse,developmentSender} from '../../src/core/features/auth/development.server'
import {bootstrapWorkspace} from '../../src/core/features/bootstrap/repository'
import {createD1DevelopmentOutbox} from '../../vendor/base/mail/src/development/index.mjs'
beforeEach(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await bootstrapWorkspace(env.DB,bindings);for(const table of ['oa_sessions','oa_tokens','rer_mail_development_outbox','oa_limits','access_rate_limits'])await env.DB.prepare(`DELETE FROM ${table}`).run()})
it('[BASE-ACCESS-001 BASE-ACCESS-004] captured-mail UI is retired; key exchange requires explicit loopback',async()=>{
 expect((await request('/__dev/outbox')).status).toBe(404)
 expect((await request('/__dev/outbox','POST',{})).status).toBe(404)
 expect((await developmentKeyResponse(bindings,new Request(origin+'/__dev/key')))?.status).toBe(200)
 for(const override of [{MAIL_MODE:'production'},{SESSION_SECRET:''},{APP_ORIGIN:'https://vector.test'}])
  expect(await developmentKeyResponse({...bindings,...override},new Request(origin+'/__dev/key'))).toBeNull()
 expect(()=>developmentSender({...bindings,APP_ORIGIN:'https://vector.test'})).toThrow()
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
