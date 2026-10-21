import {env} from 'cloudflare:workers';
import {it,expect} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {invite,actor} from './base-auth-fixture';
it('[API-002] issuance, usage and native publication retain current issuer authority inside the transaction',async()=>{
 const f=await setupIntegrations();
 await env.DB.prepare("CREATE TRIGGER deny_issued_authority AFTER INSERT ON integration_tokens BEGIN UPDATE oa_sessions SET revoked_at=1 WHERE revoked_at IS NULL; END").run();
 expect((await f.call('/settings/integrations/tokens','POST',{name:'Race',scopes:['issues:write']})).status).toBe(503);
 for(const table of ['integration_tokens','integration_token_events','vector_integration_tokens'])expect((await env.DB.prepare('SELECT count(*) n FROM '+table).first())?.n).toBe(0);
 await env.DB.prepare('DROP TRIGGER deny_issued_authority').run();
 const write=await f.issueToken(['issues:read','issues:write','projects:write','milestones:write','cycles:write','comments:write']);
 await env.DB.prepare("CREATE TRIGGER deny_native_token AFTER INSERT ON issues BEGIN UPDATE integration_tokens SET revoked_at=1 WHERE revoked_at IS NULL; END").run();
 const before=(await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results;
 expect((await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Commit race'})).status).toBe(401);
 expect((await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results).toEqual(before);expect((await env.DB.prepare('SELECT count(*) n FROM issue_activity').first())?.n).toBe(0);
 await env.DB.prepare('DROP TRIGGER deny_native_token').run();
 expect((await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Allowed after rollback'})).status).toBe(201);
 // Each newly admitted create still commits through the same token-fenced database.
 const planned=await f.api(write.token,'/projects','POST',{name:'Guarded plan',leadOperatorId:f.owner});expect(planned.status).toBe(201);
 const project=await planned.json() as {id:string};
 const issue=(await env.DB.prepare('SELECT identifier FROM issues LIMIT 1').first<{identifier:string}>())!;
 for(const [table,path,body] of [
  ['projects','/projects',{name:'Refused project',leadOperatorId:f.owner}],
  ['project_milestones','/projects/'+project.id+'/milestones',{name:'Refused milestone'}],
  ['cycles','/cycles',{name:'Refused cycle',teamId:f.initial.teams[0].id,startsLocal:'2027-06-01T09:00',endsLocal:'2027-06-15T09:00'}],
  ['issue_comments','/issues/'+issue.identifier+'/comments',{body:'Refused comment'}],
 ] as const){
  const count=await env.DB.prepare('SELECT count(*) n FROM '+table).first('n');
  await env.DB.prepare('CREATE TRIGGER deny_new_api_authority AFTER INSERT ON '+table+' BEGIN UPDATE integration_tokens SET revoked_at=1 WHERE revoked_at IS NULL; END').run();
  expect((await f.api(write.token,path,'POST',body)).status).toBe(401);
  expect(await env.DB.prepare('SELECT count(*) n FROM '+table).first('n')).toBe(count);
  await env.DB.prepare('DROP TRIGGER deny_new_api_authority').run();
 }
 const cookie=await invite('token-peer@vector.test',f.cookie),peer=await actor(cookie);
 const {request}=await import('./base-auth-fixture');const issued=await request('/api/settings/integrations/tokens','POST',{name:'Peer',scopes:['issues:read']},cookie);expect(issued.status).toBe(201);const token=(await issued.json() as {token:string}).token;
 expect((await f.api(token,'/issues')).status).toBe(200);await env.DB.prepare('UPDATE operators SET removed_at=? WHERE id=?').bind(new Date().toISOString(),peer).run();
 expect((await f.api(token,'/issues')).status).toBe(401);expect(await env.DB.prepare('SELECT count(*) n FROM integration_tokens t JOIN vector_integration_tokens b ON b.namespace=t.namespace AND b.token_id=t.id WHERE b.operator_id=? AND t.revoked_at IS NOT NULL').bind(peer).first<number>('n')).toBe(1);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);
