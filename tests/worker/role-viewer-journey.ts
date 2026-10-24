import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {doors,apiDoors} from '../../src/core/features/roles/doors';
import {invite,actor} from './base-auth-fixture';
import {resetLimits,snapshot,type roleWorkspace} from './role-fixture';
type Workspace=Awaited<ReturnType<typeof roleWorkspace>>;
const json=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};

/** Real invitation plus an already-open Member session and token cross the role boundary. */
export async function viewerVisibilityJourney(w:Workspace){
 const owner=w.people.owner,member=w.member;
 const viewerCookie=await invite('synthetic-vector-1720@vector.test',owner.cookie,'viewer'),viewerId=await actor(viewerCookie);
 expect(await env.DB.prepare('SELECT role FROM operators WHERE id=?').bind(viewerId).first('role')).toBe('viewer');
 const project=await json(await owner.api('/projects','POST',{name:'synthetic-vector-1721',leadOperatorId:owner.id}),201);
 const label=(await json(await owner.call('/settings/labels','POST',{name:'synthetic-vector-1990',color:'#3355aa'}))).labels.find((l:any)=>l.name==='synthetic-vector-1990');
 const issue=await json(await owner.call('/issues','POST',{title:'synthetic-vector-1722',teamId:w.team.id,projectId:project.id,labelIds:[label.id]}),201);
 const ownComment=await json(await member.call(`/issues/${issue.identifier}/comments`,'POST',{body:'synthetic-vector-1723'}),201);
 const reactionPath=`/issues/${issue.identifier}/reactions`;
 const quiet=await snapshot(['notifications','notification_events','notification_deliveries']);
 for(const targetId of ['',ownComment.id]) {
  const input={targetId,emoji:'👍'};
  expect((await member.call(reactionPath,'PUT',input)).status).toBe(200);
  expect((await member.call(reactionPath,'PUT',input)).status).toBe(200);
  expect((await owner.call(reactionPath,'PUT',input)).status).toBe(200);
  const reactions=(await json(await owner.call(reactionPath))).reactions.filter((r:any)=>r.targetId===targetId);
  expect(reactions).toHaveLength(2);
  expect(reactions.map((r:any)=>r.actorId).sort()).toEqual([member.id,owner.id].sort());
  expect(reactions.every((r:any)=>typeof r.actor==='string'&&r.actor.length>0)).toBe(true);
  expect((await member.call(reactionPath,'DELETE',input)).status).toBe(200);
  expect((await member.call(reactionPath,'DELETE',input)).status).toBe(200);
  expect((await json(await owner.call(reactionPath))).reactions.filter((r:any)=>r.targetId===targetId)).toHaveLength(1);
 }
 expect(await snapshot(Object.keys(quiet))).toEqual(quiet);
 const guestBefore=await snapshot(['issue_reactions']);
 expect((await w.guest.call(reactionPath,'PUT',{targetId:'',emoji:'🎉'})).status).toBe(200);
 expect((await w.guest.call(reactionPath,'DELETE',{targetId:'',emoji:'🎉'})).status).toBe(200);
 expect(await snapshot(Object.keys(guestBefore))).toEqual(guestBefore);
 const shared=await json(await owner.call('/views','POST',{name:'synthetic-vector-1724',isShared:true,query:{team:w.team.id}}),201);
 expect((await w.admin.call(`/settings/operators/${member.id}/role`,'PATCH',{role:'viewer',teamIds:[]})).status).toBe(200);
 expect((await member.call(`/issues/${issue.identifier}`,'PATCH',{expectedVersion:issue.version,title:'synthetic-vector-1725'})).status).toBe(403);
 expect((await member.api(`/issues/${issue.identifier}`,'PATCH',{expectedVersion:issue.version,title:'synthetic-vector-1725'})).status).toBe(403);
 for(const path of [`/issues/${issue.identifier}`,`/projects/${project.id}`,`/views/${shared.id}`])expect((await member.call(path)).status,path).toBe(200);
 expect((await json(await member.call('/settings/administration'))).labels).toContainEqual(expect.objectContaining({id:label.id,name:label.name}));
 expect((await json(await member.call(`/issues/${issue.identifier}`))).labels).toContainEqual(expect.objectContaining({id:label.id,name:label.name}));
 // Enumerate storage rather than maintaining an incomplete list of tables. Only
 // request-budget counters and the independently asserted bearer-use audit may change.
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' AND name NOT IN ('access_rate_limits','oa_limits','integration_token_usage') ORDER BY name").all<{name:string}>()).results.map(row=>row.name);
 const stored=async()=>Object.fromEntries(await Promise.all(tables.map(async name=>[name,(await env.DB.prepare('SELECT * FROM \"'+name+'\"').all()).results.map(row=>JSON.stringify(row)).sort()])));
 const logicalId=ownComment.id;
 // Each registered work mutation is reached through its actual native/bearer transport.
 for(const [registry,send] of [[doors,member.call],[apiDoors,member.api]] as const)for(const door of registry){
  if(door.method==='GET'||door.page==='account'&&!door.workMutation||typeof door.row==='string'&&['calendar.feeds','workspace.leave'].includes(door.row))continue;
  await resetLimits();
  const path=door.path.replace(/:([A-Za-z]+)/g,(_,name)=>name==='identifier'?issue.identifier:name==='operatorId'?owner.id:name==='teamId'?w.team.id:logicalId).replace(/\*$/,'exports');
  const before=await stored();
  const usageBefore=(await env.DB.prepare('SELECT id FROM integration_token_usage').all<{id:string}>()).results.map(row=>row.id);
  const response=await send(path,door.method==='ALL'?'POST':door.method,{});
  expect(await stored(),door.method+' '+path+' refusal changed storage').toEqual(before);
  expect(response.status,door.method+' '+path+' '+await response.clone().text()).toBe(403);
  const usage=(await env.DB.prepare('SELECT * FROM integration_token_usage').all()).results.filter(row=>!usageBefore.includes(row.id as string));
  if(registry===apiDoors){expect(usage).toHaveLength(1);expect(usage[0]).toMatchObject({resource:(door.method==='ALL'?'POST':door.method)+':'+path,allowed:1});}
  else expect(usage).toHaveLength(0);
 }
 expect((await member.call(`/issues/${issue.identifier}/comments/${ownComment.id}`,'PATCH',{body:'synthetic-vector-1726'})).status).toBe(403);
 expect((await member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-1727',scopes:['issues:read']})).status).toBe(403);
 const privateTeam=(await json(await owner.call('/settings/teams','POST',{name:'synthetic-vector-1728',identifierPrefix:'SYNVIEW',isPrivate:true}))).teams.find((t:any)=>t.name==='synthetic-vector-1728');
 const hidden=await json(await owner.call('/issues','POST',{title:'synthetic-vector-1729',teamId:privateTeam.id,statusId:privateTeam.statuses.find((status:any)=>status.category==='started').id,assigneeOperatorId:member.id}),201);
 expect((await member.call(`/issues/${hidden.identifier}`)).status).toBe(404);
 expect(JSON.stringify(await json(await member.call('/search?q=synthetic-vector-1729')))).not.toContain(hidden.identifier);
 for(const path of ['/current','/notifications','/issues?q=synthetic-vector-1729','/insights.csv?q=synthetic-vector-1729']){const response=await member.call(path);expect(response.status,path).toBe(200);expect(await response.text(),path).not.toContain(hidden.identifier);}
 expect((await w.lead.call(`/settings/teams/${w.team.id}/members/${viewerId}`,'PUT',{role:'member'})).status).toBe(403);
 expect((await w.admin.call(`/settings/teams/${privateTeam.id}/members/${member.id}`,'PUT',{role:'member'})).status).toBe(200);
 expect((await member.call(`/issues/${hidden.identifier}`)).status).toBe(200);
 expect((await member.api(`/issues/${hidden.identifier}`)).status).toBe(200);
 expect(JSON.stringify(await json(await member.call('/current')))).toContain(hidden.identifier);
 const report=await json(await member.call('/insights?q=synthetic-vector-1729'));expect(report.total).toBe(1);
 expect(await(await member.call('/insights.csv?q=synthetic-vector-1729&bucket='+encodeURIComponent(report.rows[0].key))).text()).toContain(hidden.identifier);
 expect((await member.call(`/issues/${hidden.identifier}/comments`,'POST',{body:'synthetic-vector-1730'})).status).toBe(403);
 for(const path of [`/teams/${privateTeam.id}/join`,`/teams/${privateTeam.id}/requests`])expect((await member.call(path,'POST',{})).status).toBe(403);
 const feed=await json(await member.call('/calendar/feeds','POST',{}),201);expect((await member.call(`/calendar/feeds/${feed.id}`,'DELETE',{expectedVersion:feed.version})).status).toBe(200);
 expect((await member.call('/calendar/feeds','POST',{teamId:privateTeam.id})).status).toBe(403);
 expect((await w.admin.call(`/settings/operators/${member.id}/role`,'PATCH',{role:'admin'})).status).toBe(403);
 expect((await owner.call(`/settings/operators/${member.id}/role`,'PATCH',{role:'guest',teamIds:[privateTeam.id]})).status).toBe(200);
 expect((await member.call('/issues','POST',{teamId:privateTeam.id,title:'synthetic-vector-1731'})).status).toBe(201);
 expect((await member.call('/issues','POST',{teamId:w.team.id,title:'synthetic-vector-1732'})).status).toBe(404);
 expect((await w.admin.call(`/settings/operators/${member.id}/role`,'PATCH',{role:'viewer',teamIds:[privateTeam.id]})).status).toBe(200);
 expect((await member.call('/issues','POST',{teamId:privateTeam.id,title:'synthetic-vector-1733'})).status).toBe(403);
 expect((await member.call(`/settings/operators/${member.id}`,'DELETE')).status).toBe(200);
 expect((await member.call('/session')).status).toBe(401);
}
