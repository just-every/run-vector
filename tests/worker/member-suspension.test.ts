import { env } from 'cloudflare:workers';
import { expect, it, vi } from 'vitest';
import { suspensionAgentFixture } from './suspension-agent-fixture';
import { setupAdministration } from './administration-fixture';
import { actor, bindings, confirm, invite, mailToken, origin, request, signIn } from './base-auth-fixture';
import { createServerApp } from '../../src/core/app/server';
import { agentRequest } from './agent-resource-journey';
import { pkce } from '../../src/core/features/oauth-apps/repository';
import { resetLimits, snapshot } from './role-fixture';

const address = (id:number) => 'synthetic-vector-'+id+String.fromCharCode(64)+'vector.test';

async function json(response: Response, status = 200): Promise<any> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json();
}

it('suspension keeps identity and work, revokes every native credential, and reactivation requires fresh sign-in with unchanged history', {timeout:120_000}, async () => {
  const f = await setupAdministration(), app = createServerApp(), team = f.initial.teams[0];
  const email = address(9301);
  const memberCookie = await invite(email,f.cookie), member = await actor(memberCookie);
  const otherSession = await signIn(email), admin = await invite(address(9302),f.cookie,'admin');
  const call = (cookie:string,path:string,method='GET',body?:unknown) => request('/api'+path,method,body,cookie);
  const api = (token:string,path='/issues') => app.request(origin+'/api/v1'+path,{method:'GET',headers:{Authorization:'Bearer '+token,Origin:origin}},bindings);
  const mcpMethod=['tools','list'].join('/');
  const mcp = (token:string) => agentRequest('/mcp',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':mcpMethod},body:JSON.stringify({jsonrpc:'2.0',id:1,method:mcpMethod,params:{}})});
  await json(await f.call(`/settings/teams/${team.id}/members/${member}`,'PUT',{role:'owner'}));
  const memberName = (await env.DB.prepare('SELECT name FROM operators WHERE id=?').bind(member).first<string>('name'))!;
  const token = await json(await call(memberCookie,'/settings/integrations/tokens','POST',{name:'synthetic-vector-9303',scopes:['issues:read','evidence:read']}),201);
  const readerToken = await json(await f.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-9372',scopes:['issues:read','comments:read']}),201);
  const redirect = 'https://synthetic-vector-9304.example.test/callback';
  const client = await json(await f.call('/settings/oauth-apps','POST',{name:'synthetic-vector-9304',redirectUris:[redirect],scopes:['issues:read']}),201);
  const verifier = 'synthetic-vector-9305-abcdefghijklmnopqrstuvwxyz0123456789';
  const authorization = {response_type:'code',client_id:client.id,redirect_uri:redirect,scope:'issues:read',state:'synthetic-vector-9306',code_challenge:await pkce(verifier),code_challenge_method:'S256'};
  const consent = await json(await call(memberCookie,'/oauth/consent','POST',{request:authorization,decision:'approve'}));
  const code = new URL(consent.redirect).searchParams.get('code');
  const exchangeBody = {grant_type:'authorization_code',client_id:client.id,client_secret:client.secret,code,redirect_uri:redirect,code_verifier:verifier};
  const oauth = await json(await request('/api/oauth/token','POST',exchangeBody),200);
  const pendingConsent = await json(await call(memberCookie,'/oauth/consent','POST',{request:authorization,decision:'approve'}));
  const pendingCode = new URL(pendingConsent.redirect).searchParams.get('code');
  const issue = await f.create({assigneeOperatorId:member});
  const finished = await f.create({assigneeOperatorId:member});
  for (const body of ['synthetic-vector-9307','synthetic-vector-9308']) await json(await call(memberCookie,`/issues/${issue.identifier}/comments`,'POST',{body}),201);
  await json(await call(memberCookie,`/issues/${issue.identifier}`,'PATCH',{expectedVersion:1,description:'synthetic-vector-9309'}));
  await json(await call(memberCookie,`/issues/${finished.identifier}`,'PATCH',{expectedVersion:1,statusId:team.statuses.find(s=>s.category==='completed')!.id}));
  const privateView = await json(await call(memberCookie,'/views','POST',{name:'synthetic-vector-9310',isShared:false,layout:'list',query:{team:team.id}}),201);
  const sharedView = await json(await call(memberCookie,'/views','POST',{name:'synthetic-vector-9311',isShared:true,layout:'list',query:{team:team.id}}),201);
  const project = (await json(await f.call('/settings/projects','POST',{name:'synthetic-vector-9312',leadOperatorId:member}))).projects.find((row:any)=>row.name==='synthetic-vector-9312');
  const hiddenTeam = (await json(await f.call('/settings/teams','POST',{name:'synthetic-vector-9370',identifierPrefix:'SUSPH',isPrivate:true}))).teams.find((row:any)=>row.identifierPrefix==='SUSPH');
  await json(await f.call(`/settings/teams/${hiddenTeam.id}/members/${member}`,'PUT',{role:'owner'}));
  const hiddenIssue = await json(await call(memberCookie,'/issues','POST',{title:'synthetic-vector-9371',teamId:hiddenTeam.id,assigneeOperatorId:member}),201);
  const teamsBefore = await env.DB.prepare('SELECT * FROM team_members WHERE operator_id=? ORDER BY team_id').bind(member).all();
  const historyBefore = await env.DB.prepare('SELECT * FROM issue_comments WHERE actor_operator_id=? ORDER BY id').bind(member).all();
  expect((await api(token.token)).status).toBe(200);
  expect((await api(oauth.access_token)).status).toBe(200);
  expect((await mcp(token.token)).status).toBe(200);
  const remote=await suspensionAgentFixture(member,email);
  const seen=await remote.credential('synthetic-vector-9367'),unseen=await remote.credential('synthetic-vector-9368');
  expect(await remote.call(seen)).toBe(200);
  const beforeCount = (await json(await f.call('/settings'))).operators.length;
  const refusedTables = ['operators','oa_operators','oa_sessions','oa_tokens','integration_tokens','vector_oauth_grants','member_lifecycle_events','audit_records','issues','saved_views','team_members'];
  const before = await snapshot(refusedTables);
  expect((await call(admin,`/settings/operators/${f.owner}/suspend`,'POST',{assignments:'keep'})).status).toBe(403);
  expect((await call(memberCookie,`/settings/operators/${f.owner}/suspend`,'POST',{assignments:'keep'})).status).toBe(403);
  expect(await snapshot(refusedTables)).toEqual(before);
  await json(await call(admin,`/settings/operators/${member}/suspend`,'POST',{assignments:'keep'}));
  for (const cookie of [memberCookie,otherSession]) expect((await call(cookie,'/session')).status).toBe(401);
  expect((await call(memberCookie,'/settings')).status).toBe(401);
  for (const credential of [token.token,oauth.access_token]) expect((await api(credential)).status).toBe(401);
  expect((await mcp(token.token)).status).toBe(401);
  expect(await remote.call(seen)).toBe(401);
  expect(await remote.call(unseen)).toBe(401);
  expect(await env.DB.prepare('SELECT revoked FROM agent_door_agents WHERE id=?').bind(`vector-token:${token.credential.id}`).first('revoked')).toBe(1);
  expect((await request('/api/oauth/token','POST',{...exchangeBody,code:pendingCode})).status).toBe(400);
  expect(await env.DB.prepare('SELECT count(*) n FROM vector_oauth_grants WHERE operator_id=? AND revoked_at IS NULL').bind(member).first('n')).toBe(0);
  const outbox = await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox WHERE json_extract(message,\'$.to[0]\')=?').bind(email).first('n');
  expect((await request('/auth/request','POST',{email})).status).toBe(202);
  expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox WHERE json_extract(message,\'$.to[0]\')=?').bind(email).first('n')).toBe(outbox);
  const detail = await json(await f.call('/issues/'+issue.identifier));
  expect(detail.assignee).toMatchObject({id:member,name:memberName+' (Suspended)',suspended:true});
  const listed = await json(await f.call('/issues?team='+team.id));
  expect(listed.issues.find((row:any)=>row.id===issue.id).assignee).toMatchObject({id:member,suspended:true});
  expect(listed.assignees.some((row:any)=>row.id===member)).toBe(false);
  const current = await json(await f.call('/current'));
  expect(JSON.stringify(current)).toContain(memberName+' (Suspended)');
  const comments = await json(await f.call(`/issues/${issue.identifier}/discussion`));
  expect(comments.comments).toHaveLength(2);
  expect(comments.comments.every((row:any)=>row.actor===memberName+' (Suspended)')).toBe(true);
  const apiComments = await json(await api(readerToken.token,'/comments?issue='+issue.identifier));
  expect(apiComments.comments).toHaveLength(2);
  expect(apiComments.comments.every((row:any)=>row.author.id===member && row.author.displayName===memberName+' (Suspended)')).toBe(true);
  expect((await json(await api(readerToken.token,'/issues/'+issue.identifier))).assignee).toMatchObject({id:member,suspended:true});
  const completed = await json(await f.call('/issues/'+finished.identifier));
  expect(completed.activity.some((row:any)=>row.actor===memberName+' (Suspended)')).toBe(true);
  const revisions = await json(await f.call(`/issues/${issue.identifier}/description-history`));
  expect(revisions.revisions.some((row:any)=>row.actor===memberName+' (Suspended)')).toBe(true);
  const activeSettings = await json(await f.call('/settings'));
  expect(activeSettings.operators).toHaveLength(beforeCount-1);
  expect(activeSettings.operators.some((row:any)=>row.id===member)).toBe(false);
  const directory = await json(await call(admin,'/settings/operators/suspended'));
  expect(directory.members).toContainEqual(expect.objectContaining({id:member,name:memberName+' (Suspended)',assignedIssueCount:1}));
  const profile = await json(await call(admin,`/settings/operators/${member}/suspension`));
  expect(profile).toMatchObject({id:member,state:'suspended',assignedIssues:[expect.objectContaining({identifier:issue.identifier,flag:'Assignee suspended'})]});
  expect(profile.activity.length).toBeGreaterThan(0);
  expect(JSON.stringify(profile)).not.toContain(hiddenIssue.identifier);
  expect(JSON.stringify(profile)).not.toContain(hiddenIssue.title);
  expect((await json(await f.call(`/settings/operators/${member}/suspension`))).assignedIssues).toHaveLength(2);
  const beforeLastTeamOwner = await snapshot(['team_members','team_departures','audit_records']);
  expect((await f.call(`/teams/${hiddenTeam.id}/leave`,'POST',{})).status).toBe(409);
  expect(await snapshot(['team_members','team_departures','audit_records'])).toEqual(beforeLastTeamOwner);
  expect((await env.DB.prepare('SELECT * FROM team_members WHERE operator_id=? ORDER BY team_id').bind(member).all()).results).toEqual(teamsBefore.results);
  expect((await env.DB.prepare('SELECT * FROM issue_comments WHERE actor_operator_id=? ORDER BY id').bind(member).all()).results).toEqual(historyBefore.results);
  expect(await env.DB.prepare('SELECT owner_operator_id FROM saved_views WHERE id=?').bind(privateView.id).first('owner_operator_id')).toBe(member);
  expect(await env.DB.prepare('SELECT owner_operator_id FROM saved_views WHERE id=?').bind(sharedView.id).first('owner_operator_id')).toBe(await actor(admin));
  expect(await env.DB.prepare('SELECT lead_operator_id FROM projects WHERE id=?').bind(project.id).first('lead_operator_id')).toBe(await actor(admin));
  expect((await f.state()).operators.some(row=>row.id===member)).toBe(false);
  expect((await f.call(`/settings/teams/${team.id}/members/${member}`,'PUT',{role:'member'})).status).toBe(404);
  expect((await f.call(`/settings/projects/${project.id}`,'PATCH',{leadOperatorId:member})).status).toBe(409);
  // A retained team owner is inactive. Admins still administer the team.
  expect((await call(admin,`/settings/teams/${team.id}/permissions`,'PUT',{settings:'team_owners',planning:'all_members'})).status).toBe(200);
  const viewer = await invite(address(9313),f.cookie,'viewer'), viewerId = await actor(viewer);
  expect((await call(viewer,'/settings/operators/suspended')).status).toBe(403);
  expect((await call(viewer,`/settings/operators/${member}/reactivate`,'POST',{})).status).toBe(403);
  expect((await call(viewer,`/settings/operators/${member}/suspend`,'POST',{assignments:'keep'})).status).toBe(403);
  await json(await call(viewer,`/settings/operators/${viewerId}`,'DELETE'));
  expect((await call(viewer,'/session')).status).toBe(401);
  await json(await call(admin,`/settings/operators/${member}/reactivate`,'POST',{}));
  expect((await call(memberCookie,'/session')).status).toBe(401);
  for (const credential of [token.token,oauth.access_token]) expect((await api(credential)).status).toBe(401);
  expect((await mcp(token.token)).status).toBe(401);
  expect(await env.DB.prepare('SELECT revoked FROM agent_door_agents WHERE id=?').bind(`vector-token:${token.credential.id}`).first('revoked')).toBe(1);
  expect(await remote.call(seen)).toBe(401);
  expect(await remote.call(unseen)).toBe(401);
  vi.useFakeTimers({toFake:['Date']});
  try {
    vi.setSystemTime(new Date((remote.issuedAt+60)*1000));
    expect(await remote.call(await remote.credential('synthetic-vector-9369',remote.issuedAt+60))).toBe(200);
    expect(await remote.call(unseen)).toBe(401);
  } finally {vi.useRealTimers();}
  await resetLimits();
  const fresh = await signIn(email);
  expect(await actor(fresh)).toBe(member);
  expect((await json(await call(fresh,'/views/'+privateView.id))).name).toBe('synthetic-vector-9310');
  expect((await json(await call(fresh,`/issues/${issue.identifier}/discussion`))).comments.map((row:any)=>row.actor)).toEqual([memberName,memberName]);
  expect((await json(await api(readerToken.token,'/comments?issue='+issue.identifier))).comments.map((row:any)=>row.author.displayName)).toEqual([memberName,memberName]);
  expect((await env.DB.prepare('SELECT * FROM team_members WHERE operator_id=? ORDER BY team_id').bind(member).all()).results).toEqual(teamsBefore.results);
  const freshToken = await json(await call(fresh,'/settings/integrations/tokens','POST',{
    name:'synthetic-vector-9375',scopes:['issues:read'],
  }),201);
  await json(await call(fresh,'/settings/integrations/tokens/'+freshToken.credential.id,'DELETE'));
  const revoked = (await json(await f.call('/settings/audit?subject='+freshToken.credential.id))).entries
    .find((entry:any)=>entry.action==='token.revoked');
  expect(revoked).toMatchObject({actorRef:'person:'+member});
  // Repeated offboarding is a new receipt. Re-inviting preserves the old role.
  await json(await call(admin,`/settings/operators/${member}/suspend`,'POST',{assignments:'unassign'}));
  expect((await json(await f.call('/issues/'+issue.identifier))).assignee).toBeNull();
  await resetLimits();
  await json(await f.call('/settings/operators/invite','POST',{email,displayName:'Untrusted replacement name',role:'admin'}),202);
  const reinvited = await confirm(await mailToken(email));
  expect(await actor(reinvited)).toBe(member);
  expect(await env.DB.prepare('SELECT role,name FROM operators WHERE id=?').bind(member).first()).toEqual({role:'member',name:memberName});
  const events = (await env.DB.prepare('SELECT action,method FROM member_lifecycle_events WHERE operator_id=? ORDER BY created_at,id').bind(member).all()).results;
  expect(events).toEqual([{action:'suspended',method:'settings'},{action:'reactivated',method:'settings'},{action:'suspended',method:'settings'},{action:'reactivated',method:'invitation'}]);
  expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE subject_id=? AND action IN('operator.suspended','operator.reactivated')").bind(member).first('n')).toBe(4);
  expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE subject_id=? AND action='operator.left'").bind(viewerId).first('n')).toBe(1);
  const auditEntries = (await json(await f.call('/settings/audit?subject='+member))).entries
    .filter((entry:any)=>['operator.suspended','operator.reactivated'].includes(entry.action));
  const adminId = await actor(admin);
  expect(auditEntries).toHaveLength(4);
  expect(auditEntries.filter((entry:any)=>entry.action==='operator.suspended')).toEqual([
    expect.objectContaining({actorRef:'person:'+adminId,method:'settings'}),
    expect.objectContaining({actorRef:'person:'+adminId,method:'settings'}),
  ]);
  expect(auditEntries.filter((entry:any)=>entry.action==='operator.reactivated')).toEqual(expect.arrayContaining([
    expect.objectContaining({actorRef:'person:'+adminId,method:'settings'}),
    expect.objectContaining({actorRef:'person:'+f.owner,method:'invitation'}),
  ]));
  const leaveAudit = (await json(await f.call('/settings/audit?subject='+viewerId))).entries.find((entry:any)=>entry.action==='operator.left');
  expect(leaveAudit).toMatchObject({actorRef:'person:'+viewerId,actorName:expect.stringContaining('(Suspended)'),method:'self'});
  const auditCsv = await f.call('/settings/audit.csv?action=operator.reactivated&subject='+member);
  expect(auditCsv.status).toBe(200);
  const csvRows=(await auditCsv.text()).trim().split('\r\n');
  expect(csvRows).toHaveLength(3);
  expect(csvRows.slice(1).map(row=>row.split(',').at(-1))).toEqual(expect.arrayContaining(['"settings"','"invitation"']));
  expect((await api(token.token)).status).toBe(401);
  const oldAdminId = await actor(admin);
  await json(await f.call(`/settings/operators/${oldAdminId}/suspend`,'POST',{assignments:'keep'}));
  const admin2 = await invite(address(9314),f.cookie,'admin');
  expect((await call(admin2,`/settings/operators/${oldAdminId}/reactivate`,'POST',{})).status).toBe(403);
  expect((await call(admin2,'/settings/operators/invite','POST',{email:address(9302),displayName:'synthetic-vector-9315',role:'member'})).status).toBe(403);
  await json(await f.call(`/settings/operators/${oldAdminId}/reactivate`,'POST',{}));
  await env.DB.prepare(`INSERT INTO operators(id,workspace_id,name,email,removed_at,created_at,updated_at)
    SELECT '01K00000000000000000009344',workspace_id,'Removed operator','01K00000000000000000009344'||char(64)||'removed.invalid','2026-10-01','2026-10-01','2026-10-01' FROM operators WHERE id=?`).bind(f.owner).run();
  const legacyBefore = await snapshot(refusedTables);
  expect((await f.call('/settings/operators/01K00000000000000000009344/reactivate','POST',{})).status).toBe(409);
  expect(await snapshot(refusedTables)).toEqual(legacyBefore);

});
