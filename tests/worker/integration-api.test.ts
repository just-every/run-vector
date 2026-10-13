import {env} from 'cloudflare:workers';
import {it,expect} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {origin,bindings} from './base-auth-fixture';
import {createIntegrationApi} from '../../src/core/features/integrations/api';
it('[API-001 API-002] Base scoped token authority drives native routes, usage, stale writes and revocation without HTML or file admission',async()=>{
 const f=await setupIntegrations(),read=await f.issueToken(['issues:read','metadata:read']),write=await f.issueToken(['issues:read','issues:write','comments:write']);
 expect((await f.api('', '/issues')).status).toBe(401);expect((await f.api('int_'+'a'.repeat(64),'/issues')).status).toBe(401);
 f.restart();
 expect((await f.api(read.token,'/metadata')).status).toBe(200);expect((await f.api(read.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Denied'})).status).toBe(401);
 const created=await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Native API issue'});expect(created.status).toBe(201);const issue=await created.json() as {identifier:string;id:string;version:number};
 const before=(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first());
 expect((await f.api(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version+1,title:'Stale'})).status).toBe(409);expect(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first()).toEqual(before);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,title:'Updated through native rule'})).status).toBe(200);
 expect((await f.api(write.token,'/issues/'+issue.identifier+'/comments','POST',{body:'API comment'})).status).toBe(201);
 expect((await f.api(read.token,'/issues?workspaceId=spoof')).status).toBe(400);expect((await f.api(read.token,'/issues/'+issue.identifier)).status).toBe(200);
 // Foreign native records are test data only; the token cannot widen its issuer workspace.
 const foreignWorkspace='01K00000000000000000000110',foreignTeam='01K00000000000000000000111',foreignStatus='01K00000000000000000000112';
 await env.DB.batch([
  env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) SELECT ?,'Other fixture workspace',timezone,created_at,updated_at FROM workspace_settings LIMIT 1").bind(foreignWorkspace),
  env.DB.prepare("INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) SELECT ?,?,'Other fixture team','OTH',created_at,updated_at FROM teams LIMIT 1").bind(foreignTeam,foreignWorkspace),
  env.DB.prepare("INSERT INTO workflow_statuses(id,team_id,name,category,position,created_at,updated_at) SELECT ?,?,name,category,position,created_at,updated_at FROM workflow_statuses WHERE category='backlog' LIMIT 1").bind(foreignStatus,foreignTeam),
  env.DB.prepare('UPDATE issues SET team_id=? WHERE id=?').bind(foreignTeam,issue.id),
 ]);
 // Exercise the real mounted API router against this otherwise unsupported
 // multi-workspace fixture, independently of installation bootstrap refusal.
 const router=createIntegrationApi(),foreign=(token:string,path:string,method='GET',body?:unknown)=>router.request(origin+path,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},bindings);
 const foreignBefore=await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first();
 expect((await foreign(read.token,'/issues/'+issue.identifier)).status).toBe(404);
 expect((await foreign(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version+1,title:'Foreign mutation'})).status).toBe(404);
 expect((await foreign(write.token,'/issues/'+issue.identifier+'/comments','POST',{body:'Foreign comment'})).status).toBe(404);
 expect((await foreign(write.token,'/issues','POST',{teamId:foreignTeam,title:'Foreign creation'})).status).toBe(400);
 expect(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first()).toEqual(foreignBefore);
 await env.DB.batch([env.DB.prepare('UPDATE issues SET team_id=? WHERE id=?').bind(f.initial.teams[0].id,issue.id),env.DB.prepare('DELETE FROM team_issue_history WHERE team_id=?').bind(foreignTeam),env.DB.prepare('DELETE FROM workflow_statuses WHERE id=?').bind(foreignStatus),env.DB.prepare('DELETE FROM teams WHERE id=?').bind(foreignTeam),env.DB.prepare('DELETE FROM workspace_settings WHERE id=?').bind(foreignWorkspace)]);
 const listed=await f.call('/settings/integrations');expect(listed.status).toBe(200);const text=await listed.text();expect(text.includes(read.token)||text.includes(write.token)).toBe(false);
 expect((await f.call('/settings/integrations/tokens/usage')).status).toBe(200);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'DELETE')).status).toBe(404);
 expect((await f.app.request(origin+'/api/session',{headers:{Authorization:'Bearer '+write.token}},bindings)).status).toBe(401);
 await env.DB.prepare('CREATE TRIGGER deny_token_usage BEFORE INSERT ON integration_token_usage BEGIN SELECT RAISE(ABORT,\'usage failure\'); END').run();
 expect((await f.api(read.token,'/issues')).status).toBe(503);await env.DB.prepare('DROP TRIGGER deny_token_usage').run();expect((await f.api(read.token,'/issues')).status).toBe(200);
 const profile=await env.DB.prepare('SELECT token_id AS id FROM vector_integration_tokens WHERE name=? LIMIT 1').bind('Native API').first<{id:string}>();
 expect((await f.call('/settings/integrations/tokens/'+profile!.id,'DELETE')).status).toBe(200);expect((await f.api(read.token,'/issues')).status).toBe(401);
 await env.DB.prepare('UPDATE integration_tokens SET expires_at=1 WHERE token_hash IS NOT NULL').run();expect((await f.api(write.token,'/issues')).status).toBe(401);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);
