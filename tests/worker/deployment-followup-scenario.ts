import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {invite,actor,request,bindings} from './base-auth-fixture';
import {scheduled} from '../../src/core/app/scheduled';
import type {InboxPage} from '../../src/core/features/notifications/schema';
import type {setupIntegrations} from './integration-fixture';
type Send=(value:unknown,delivery?:string,tamper?:boolean,event?:string)=>Promise<Response>;
type Fixture=Awaited<ReturnType<typeof setupIntegrations>>;
type Issue={id:string;identifier:string};
const hour=3600_000,repository={full_name:'octocat/test-repo1'};
const iso=(at:number)=>new Date(at).toISOString();
const sha=(n:number)=>n.toString(16).padStart(2,'0').repeat(20);

/** PUSH-003 through the mounted signed receiver and the real scheduled export:
 * a proven production deployment records production and is never asked about;
 * an undeployed merge asks its current assignee exactly once after the team's
 * explicit window, and never before it. Runs after the RELEASE-002 scenario,
 * whose team rules move merges to Done and production deploys to Shipped. */
export async function exerciseDeploymentFollowups(f:Fixture,send:Send){
 const team=f.initial.teams[0],tick=(at:number)=>scheduled({scheduledTime:at},bindings);
 const memberCookie=await invite('synthetic-vector-1901@example.test',f.cookie),member=await actor(memberCookie);
 const otherCookie=await invite('synthetic-vector-1902@example.test',f.cookie),other=await actor(otherCookie);
 const viewerCookie=await invite('synthetic-vector-1903@example.test',f.cookie,'viewer');
 const guestCookie=await invite('synthetic-vector-1904@example.test',f.cookie),guest=await actor(guestCookie);
 expect((await f.call('/settings/operators/'+guest+'/role','PATCH',{role:'guest',teamIds:[team.id]})).status).toBe(200);
 for(const id of [member,other])expect((await f.call('/settings/teams/'+team.id+'/members/'+id,'PUT',{role:'member'})).status).toBe(200);
 const planning=(await f.state()).teams.find(t=>t.id===team.id)!.planningPermission;

 // GitHub reports every merge below 25 hours ago; each is received now.
 const mergedAt=Date.now()-25*hour;
 const merge=(number:number,issue:Issue,commit:string,at=mergedAt,action='closed')=>({action,number,repository,pull_request:{number,title:'Fixes '+issue.identifier,body:null,state:'closed',merged:true,merge_commit_sha:commit,merged_at:iso(at),updated_at:iso(at),html_url:'https://github.com/octocat/test-repo1/pull/'+number}});
 const deployment=(id:number,commit:string,environment:string,at:number,state='success')=>({repository,deployment:{id,sha:commit,environment},deployment_status:{state,created_at:iso(at)}});
 const ok=async(response:Promise<Response>)=>{const r=await response;expect(r.status,await r.clone().text()).toBe(200);};
 const create=(title:string,assigneeOperatorId:string|null,teamId=team.id)=>f.create({title,assigneeOperatorId,teamId});
 // A merge received before its team turns the window on is never followed.
 const early=await create('synthetic-vector-1916 merged before the window',member);
 await ok(send(merge(67,early,sha(185))));

 // ROLE-009 both ways through the existing team-settings door; refusals change nothing.
 const setWindow=(cookie:string,windowHours:number|null,expectedVersion:number,teamId=team.id)=>request('/api/settings/teams/'+teamId,'PATCH',{deploymentFollowup:{windowHours,expectedVersion}},cookie);
 const stored=async()=>({rows:(await env.DB.prepare('SELECT * FROM team_deployment_followups ORDER BY team_id').all()).results,
  audits:(await env.DB.prepare("SELECT id FROM audit_records WHERE action='team.deployment_followup_changed' ORDER BY id").all()).results});
 const untouched=await stored();
 for(const cookie of [viewerCookie,guestCookie,memberCookie])expect((await setWindow(cookie,24,0)).status).toBe(403);
 expect(await stored()).toEqual(untouched);
 expect((await f.call('/settings/teams/'+team.id+'/permissions','PUT',{settings:'all_members',planning})).status).toBe(200);
 for(const cookie of [viewerCookie,guestCookie])expect((await setWindow(cookie,24,0)).status).toBe(403);
 expect(await stored()).toEqual(untouched);
 const saved=await setWindow(memberCookie,24,0);expect(saved.status,await saved.clone().text()).toBe(200);
 expect(((await saved.json()) as {followup:object}).followup).toMatchObject({windowHours:24,version:1});
 expect((await setWindow(memberCookie,12,0)).status).toBe(409);
 expect((await f.call('/settings/teams/'+team.id+'/permissions','PUT',{settings:'team_owners',planning})).status).toBe(200);
 const configured=await stored();
 expect((await setWindow(memberCookie,null,1)).status).toBe(403);
 expect(await stored()).toEqual(configured);
 expect(configured.audits).toHaveLength(1);
 const rules=(await (await f.call('/github/automation')).json()) as {teams:{id:string;followup:object}[]};
 expect(rules.teams.find(t=>t.id===team.id)!.followup).toMatchObject({windowHours:24,version:1});

 // A private team keeps its own window; its assignee's access is withdrawn below.
 expect((await f.call('/settings/teams','POST',{name:'synthetic-vector-1905',identifierPrefix:'SYNP',isPrivate:true})).status).toBe(200);
 const privateTeam=(await f.state()).teams.find(t=>t.identifierPrefix==='SYNP')!;
 expect((await f.call('/settings/teams/'+privateTeam.id+'/members/'+other,'PUT',{role:'member'})).status).toBe(200);
 expect((await setWindow(f.cookie,24,0,privateTeam.id)).status).toBe(200);

 const deployed=await create('synthetic-vector-1910 deployed merge',member),waiting=await create('synthetic-vector-1911 undeployed merge',member);
 const reassigned=await create('synthetic-vector-1912 reassigned merge',member),unassigned=await create('synthetic-vector-1913 unassigned merge',null);
 const removed=await create('synthetic-vector-1914 deleted merge',member),withdrawn=await create('synthetic-vector-1915 private merge',other,privateTeam.id);

 // One merge followed by a production deployment of a descendant that a signed
 // non-forced push proves includes it: production is recorded, never questioned.
 await ok(send(merge(61,deployed,sha(161))));
 await ok(send({ref:'refs/heads/main',before:sha(161),after:sha(162),forced:false,repository:{...repository,default_branch:'main'},commits:[]},crypto.randomUUID(),false,'push'));
 await ok(send(deployment(961,sha(162),'production',mergedAt+2*hour),crypto.randomUUID(),false,'deployment_status'));
 const projection=async(issue:Issue)=>((await (await f.call('/issues/'+issue.identifier+'/github')).json()) as {productionFollowups:{pullNumber:number;productionAt:string|null;askedAt:string|null;recipient:string|null;mergedAt:string;answeredAt:string|null}[]}).productionFollowups;
 expect(await projection(deployed)).toEqual([expect.objectContaining({pullNumber:61,mergedAt:iso(mergedAt),productionAt:iso(mergedAt+2*hour),askedAt:null})]);

 // The second merge never deploys: staging, a failed production run and an unknown SHA prove nothing.
 const waitingMerge=crypto.randomUUID();
 await ok(send(merge(62,waiting,sha(171)),waitingMerge));
 await ok(send(deployment(971,sha(171),'staging',mergedAt+hour),crypto.randomUUID(),false,'deployment_status'));
 await ok(send(deployment(972,sha(171),'production',mergedAt+hour,'failure'),crypto.randomUUID(),false,'deployment_status'));
 await ok(send(deployment(973,sha(179),'production',mergedAt+hour),crypto.randomUUID(),false,'deployment_status'));
 // Duplicate and later deliveries of the merge never restart its window.
 await ok(send(merge(62,waiting,sha(171)),waitingMerge));
 await ok(send(merge(62,waiting,sha(171),mergedAt+20*hour,'edited')));
 for(const [number,issue,commit] of [[63,reassigned,181],[64,unassigned,182],[65,removed,183],[66,withdrawn,184]] as const)await ok(send(merge(number,issue,sha(commit))));
 expect(await projection(waiting)).toEqual([expect.objectContaining({pullNumber:62,mergedAt:iso(mergedAt),productionAt:null,askedAt:null})]);

 // Current assignment and access decide who is asked; deletion removes the watch.
 expect((await f.call('/issues/'+reassigned.identifier,'PATCH',{assigneeOperatorId:other,expectedVersion:(await read(f,reassigned)).version})).status).toBe(200);
 expect((await f.call('/settings/teams/'+privateTeam.id+'/members/'+other,'DELETE')).status).toBe(200);
 const deletion=await f.call('/issues/'+removed.identifier,'DELETE',{expectedVersion:(await read(f,removed)).version,confirmed:true});expect(deletion.status,await deletion.clone().text()).toBe(200);
 expect(await env.DB.prepare('SELECT count(*) AS n FROM deployment_followup_watches WHERE issue_id=?').bind(removed.id).first<number>('n')).toBe(0);

 const questions=async()=>(await env.DB.prepare(`SELECT i.identifier,n.recipient_id AS recipient,n.actor_name AS actor,n.causes_json AS causes FROM notifications n JOIN issues i ON i.id=n.issue_id
  WHERE EXISTS(SELECT 1 FROM json_each(n.causes_json) WHERE value='deployment_question') ORDER BY i.identifier`).all()).results;
 const entries=async(issue:Issue)=>(await env.DB.prepare("SELECT actor_operator_id,actor_name,next_value_json FROM issue_activity WHERE issue_id=? AND kind='deployment.followup_asked'").bind(issue.id).all()).results;
 const before=Object.fromEntries(await Promise.all([waiting,reassigned].map(async issue=>[issue.identifier,await read(f,issue)])));
 // A run one hour before the window ends asks nothing.
 await tick(mergedAt+23*hour);
 expect(await questions()).toEqual([]);
 // A restore that holds effects asks nothing; releasing it lets the next run ask.
 const askedAt=Date.now();
 await env.DB.prepare('INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,?,1)').bind('synthetic-vector-1917').run();
 await tick(askedAt);
 expect(await questions()).toEqual([]);
 await env.DB.prepare('DELETE FROM vector_restore_status').run();
 await tick(askedAt);
 const asked=[{identifier:reassigned.identifier,recipient:other},{identifier:waiting.identifier,recipient:member}].sort((a,b)=>a.identifier.localeCompare(b.identifier));
 expect(await questions()).toEqual(asked.map(row=>({...row,actor:'Deployment follow-up',causes:'["deployment_question"]'})));
 for(const issue of [waiting,reassigned]){
  expect(await entries(issue)).toEqual([{actor_operator_id:null,actor_name:'Deployment follow-up',next_value_json:JSON.stringify({pullNumber:issue===waiting?62:63,sha:sha(issue===waiting?171:181),mergedAt:iso(mergedAt),windowHours:24})}]);
  // Asking changes no priority, due date, assignee, status or version.
  expect(await read(f,issue)).toEqual(before[issue.identifier]);
 }
 expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_records WHERE action='deployment.followup_asked' AND actor_operator_id IS NULL").first<number>('n')).toBe(2);
 const inbox=async(cookie:string)=>((await (await request('/api/notifications?limit=50','GET',undefined,cookie)).json()) as InboxPage).items.filter(item=>item.causes.includes('deployment_question'));
 expect((await inbox(memberCookie)).map(item=>({identifier:item.identifier,actor:item.actor}))).toEqual([{identifier:waiting.identifier,actor:'Deployment follow-up'}]);
 expect(await inbox(f.cookie)).toEqual([]);
 expect(await projection(waiting)).toEqual([expect.objectContaining({askedAt:iso(askedAt),productionAt:null,recipient:'synthetic-vector-1901',answeredAt:null})]);

 // Repeated runs and deliveries never ask again; the unassigned merge waits for an assignee.
 await ok(send(merge(62,waiting,sha(171)),waitingMerge));
 await ok(send(merge(62,waiting,sha(171)),crypto.randomUUID()));
 for(const at of [askedAt+hour,askedAt+24*hour])await tick(at);
 expect(await questions()).toHaveLength(2);
 expect((await f.call('/issues/'+unassigned.identifier,'PATCH',{assigneeOperatorId:member,expectedVersion:(await read(f,unassigned)).version})).status).toBe(200);
 await tick(askedAt+25*hour);await tick(askedAt+26*hour);
 expect((await questions()).filter(row=>row.identifier===unassigned.identifier)).toEqual([{identifier:unassigned.identifier,recipient:member,actor:'Deployment follow-up',causes:'["deployment_question"]'}]);
 // Withdrawn private-team access, a deployed merge and a pre-window merge are never asked.
 for(const issue of [withdrawn,deployed,early])expect(await entries(issue)).toEqual([]);
 expect(await questions()).toHaveLength(3);

 // The assignee answers in the issue's discussion; a delayed production
 // deployment still records production and asks nothing further.
 expect((await request('/api/issues/'+waiting.identifier+'/comments','POST',{body:'synthetic-vector-1918 waiting on the release train'},memberCookie)).status).toBe(201);
 await ok(send(deployment(974,sha(171),'production',mergedAt+30*hour),crypto.randomUUID(),false,'deployment_status'));
 await tick(askedAt+27*hour);
 expect(await projection(waiting)).toEqual([expect.objectContaining({askedAt:iso(askedAt),productionAt:iso(mergedAt+30*hour),answeredAt:expect.any(String)})]);
 expect(await questions()).toHaveLength(3);
 await exerciseLateEvidence(f,send,{member,other,memberCookie,otherCookie,withdrawn});
}

async function read(f:Fixture,issue:Issue){
 const response=await f.call('/issues/'+issue.identifier);expect(response.status).toBe(200);
 const body=await response.json() as {version:number;priority:string;dueDate:string|null;assignee:unknown;status:{id:string};completedAt?:string|null};
 return {version:body.version,priority:body.priority,dueDate:body.dueDate,assignee:body.assignee,status:body.status.id,completedAt:body.completedAt??null};
}

/** Retained PR links and late ancestry use the same signed receiver, scheduled
 * export, issue projection and recipient Inbox as the original journey. */
async function exerciseLateEvidence(f:Fixture,send:Send,people:{member:string;other:string;memberCookie:string;otherCookie:string;withdrawn:Issue}){
 const {member,other,memberCookie,otherCookie,withdrawn}=people,team=f.initial.teams[0];
 const create=(title:string)=>f.create({title,teamId:team.id,assigneeOperatorId:member});
 const dropped=await create('synthetic-vector-1960 removed PR reference'),late=await create('synthetic-vector-1961 late ancestry');
 const erased=await create('synthetic-vector-1962 erased retained link'),never=await create('synthetic-vector-1963 never linked');
 const now=Date.now(),mergedAt=now-25*hour,productionAt=iso(mergedAt+2*hour);
 const pr=(number:number,issue:Issue|null,action:string,at:number,merged=false)=>({action,number,repository,pull_request:{number,
  title:issue?'Fixes '+issue.identifier:'synthetic-vector-1964 reference removed',body:null,state:merged?'closed':'open',merged,
  merge_commit_sha:merged?sha(number):null,merged_at:merged?iso(mergedAt):null,updated_at:iso(at),html_url:'https://github.com/octocat/test-repo1/pull/'+number}});
 const ok=async(body:unknown,event='pull_request',delivery=crypto.randomUUID())=>{const r=await send(body,delivery,false,event);expect(r.status,await r.clone().text()).toBe(200);};
 const receipts=[];
 for(const [number,issue] of [[101,dropped],[102,dropped],[103,withdrawn],[104,erased]] as const){
  await ok(pr(number,issue,'opened',mergedAt-2*hour));
  await ok(pr(number,null,'edited',mergedAt-hour));
  const body=pr(number,null,'closed',mergedAt,true),delivery=crypto.randomUUID();receipts.push({body,delivery});
  if(issue===erased)expect((await f.call('/issues/'+erased.identifier,'DELETE',{expectedVersion:(await read(f,erased)).version,confirmed:true})).status).toBe(200);
  await ok(body,'pull_request',delivery);
 }
 await ok(pr(105,null,'closed',mergedAt,true));
 expect((await f.call('/issues/'+dropped.identifier,'PATCH',{assigneeOperatorId:other,expectedVersion:(await read(f,dropped)).version})).status).toBe(200);
 await ok(pr(106,late,'closed',mergedAt,true));
 const deployment={repository,deployment:{id:1961,sha:sha(108),environment:'production'},deployment_status:{state:'success',created_at:productionAt}},deploymentId=crypto.randomUUID();
 await ok(deployment,'deployment_status',deploymentId);
 const projection=async(issue:Issue)=>((await (await f.call('/issues/'+issue.identifier+'/github')).json()) as {productionFollowups:{sha:string;askedAt:string|null;productionAt:string|null}[]}).productionFollowups;
 const inbox=async(cookie:string,issue:Issue)=>((await (await request('/api/notifications?limit=50','GET',undefined,cookie)).json()) as InboxPage).items.filter(n=>n.identifier===issue.identifier&&n.causes.includes('deployment_question'));
 await scheduled({scheduledTime:now},bindings);
 expect(await projection(dropped)).toEqual([expect.objectContaining({sha:sha(101),askedAt:iso(now),productionAt:null}),expect.objectContaining({sha:sha(102),askedAt:iso(now),productionAt:null})]);
 expect(await inbox(otherCookie,dropped)).toHaveLength(2);expect(await inbox(memberCookie,dropped)).toHaveLength(0);
 expect(await projection(never)).toEqual([]);expect(await inbox(memberCookie,never)).toEqual([]);
 expect(await env.DB.prepare('SELECT count(*) AS n FROM deployment_followup_watches WHERE issue_id=?').bind(erased.id).first<number>('n')).toBe(0);
 expect(await env.DB.prepare("SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND kind='deployment.followup_asked'").bind(withdrawn.id).first<number>('n')).toBe(0);
 expect(await projection(late)).toEqual([expect.objectContaining({askedAt:iso(now),productionAt:null})]);expect(await inbox(memberCookie,late)).toHaveLength(1);
 const push=(before:string,after:string,forced=false)=>({ref:'refs/heads/main',before,after,forced,repository:{...repository,default_branch:'main'},commits:[]});
 await ok(push(sha(106),sha(108),true),'push');await scheduled({scheduledTime:now+hour},bindings);
 expect((await projection(late))[0]!.productionAt).toBeNull();
 // Both non-forced ancestry edges arrive after the question and deployment.
 const proof=push(sha(107),sha(108)),proofId=crypto.randomUUID();
 await ok(push(sha(106),sha(107)),'push');await ok(proof,'push',proofId);
 await scheduled({scheduledTime:now+2*hour},bindings);
 const settled=await projection(late);expect(settled).toEqual([expect.objectContaining({askedAt:iso(now),productionAt})]);
 const before=await read(f,late);
 for(const {body,delivery} of receipts){await ok(body,'pull_request',delivery);await ok(body);}
 await ok(proof,'push',proofId);await ok(proof,'push');await ok(deployment,'deployment_status',deploymentId);
 for(const at of [now+3*hour,now+4*hour])await scheduled({scheduledTime:at},bindings);
 expect(await projection(late)).toEqual(settled);expect(await read(f,late)).toEqual(before);
 expect(await inbox(memberCookie,late)).toHaveLength(1);expect(await inbox(otherCookie,dropped)).toHaveLength(2);
 expect(await env.DB.prepare("SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND kind='deployment.followup_asked'").bind(late.id).first<number>('n')).toBe(1);
}
