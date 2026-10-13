import {env} from 'cloudflare:workers'
import {applyD1Migrations} from 'cloudflare:test'
import {expect,inject,it} from 'vitest'
import {bootstrapWorkspace} from '../../src/core/features/bootstrap/repository'
import {bindings,request} from './base-auth-fixture'
import {afterNativeStatement} from './notification-session-fixture'
import {testCookie,testSessionFence} from './native-fixture'
for(const hosted of [false,true])it(`[BASE-ACCESS-002] ${hosted?'hosted':'local'} ordinary issue reads preserve the captured session through final native admission`,async()=>{
 await applyD1Migrations(env.DB,inject('migrations'));await bootstrapWorkspace(env.DB,bindings)
 const owner=(await env.DB.prepare('SELECT id FROM operators LIMIT 1').first<{id:string}>())!,team=(await env.DB.prepare('SELECT id FROM teams LIMIT 1').first<{id:string}>())!
 const cookie=await testCookie(env.DB,owner.id),current=hosted?{...bindings,APP_ORIGIN:'https://vector.example.test',MAIL_MODE:'production',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'test-only-no-provider-call'}:bindings
 expect((await request('/api/issues','POST',{title:'Private last SQL projection',teamId:team.id},cookie,current)).status).toBe(201)
 expect((await request('/api/issues','GET',undefined,cookie,current)).status).toBe(200)
 const fence=await testSessionFence(env.DB,cookie);let fired=false
 const db=afterNativeStatement(async sql=>{if(!fired && sql.includes('FROM issues')&&!sql.includes('SELECT EXISTS')) {fired=true;await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(),fence.sessionId).run()}})
 const response=await request('/api/issues','GET',undefined,cookie,{...current,DB:db})
 expect(fired).toBe(true);expect(await env.DB.prepare('SELECT count(*) n FROM oa_sessions WHERE revoked_at IS NULL').first('n')).toBe(0)
 expect(response.status).toBe(401);expect(await response.text()).not.toContain('Private last SQL projection')
});
