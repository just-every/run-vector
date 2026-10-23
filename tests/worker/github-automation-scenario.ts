import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import type {setupIntegrations} from './integration-fixture';
type Send=(value:unknown,delivery?:string,tamper?:boolean,event?:string)=>Promise<Response>;
export async function exerciseGithubAutomation(f:Awaited<ReturnType<typeof setupIntegrations>>,send:Send){
 const team=f.initial.teams[0],target=await f.create({title:'synthetic-vector-1701 checkout'}),contributing=await f.create({title:'synthetic-vector-1702 contributing work'});
 const created=await f.call('/settings/teams/'+team.id+'/statuses','POST',{name:'In Review',category:'started'});
 expect(created.status,await created.clone().text()).toBe(200);
 const state=await f.state(),review=state.teams[0].statuses.find(s=>s.name==='In Review')!,done=team.statuses.find(s=>s.category==='completed')!,started=team.statuses.find(s=>s.category==='started')!;
 const saved=await f.call('/settings/teams/'+team.id,'PATCH',{githubAutomation:{trigger:'review',statusId:review.id,allowReopen:false,expectedVersion:0}});
 expect(saved.status,await saved.clone().text()).toBe(200);
 expect((await f.call('/settings/teams/'+team.id,'PATCH',{githubAutomation:{trigger:'review',statusId:review.id,allowReopen:false,expectedVersion:0}})).status).toBe(409);
 const fixture=(action:string,at:string,merged=false)=>({action,number:43,repository:{full_name:'octocat/test-repo1'},pull_request:{number:43,title:'Fixes '+target.identifier,body:'Part of '+contributing.identifier,head:{ref:target.identifier.toLowerCase()+'-checkout'},draft:!merged,state:merged?'closed':'open',merged,merge_commit_sha:merged?'a'.repeat(40):null,updated_at:at,html_url:'https://github.com/octocat/test-repo1/pull/43'}});
 const receipts=[];
 for(const [action,at,status] of [['opened','2026-10-05T01:00:00.000Z',started.id],['review_requested','2026-10-05T02:00:00.000Z',review.id],['closed','2026-10-05T03:00:00.000Z',done.id]]){
  const body=fixture(action,at,action==='closed'),id=crypto.randomUUID();receipts.push({body,id});
  expect((await send(body,id)).status).toBe(200);
  expect((await (await f.call('/issues/'+target.identifier)).json()) as object).toMatchObject({status:{id:status}});
 }
 const moves=async()=> (await env.DB.prepare("SELECT actor_operator_id,actor_name,next_value_json FROM issue_activity WHERE issue_id=? AND kind='issue.status_changed'").bind(target.id).all()).results;
 expect(await moves()).toHaveLength(3);
 for(const move of await moves())expect(move).toMatchObject({actor_operator_id:null,actor_name:'Git automation'});
 const notices=async()=> (await env.DB.prepare('SELECT actor_id,actor_name,causes_json FROM notifications WHERE issue_id=? ORDER BY created_at,id').bind(target.id).all()).results;
 expect(await notices()).toHaveLength(3);
 expect((await notices()).filter(n=>JSON.parse(String(n.causes_json)).includes('completed'))).toHaveLength(1);
 for(const notice of await notices())expect(notice).toMatchObject({actor_id:null,actor_name:'Git automation'});
 for(const {body,id} of receipts)expect((await send(body,id)).status).toBe(200);
 expect(await moves()).toHaveLength(3);expect(await notices()).toHaveLength(3);
 expect(await env.DB.prepare('SELECT status_id FROM issues WHERE id=?').bind(contributing.id).first<string>('status_id')).not.toBe(done.id);
 const completed=await f.create({title:'synthetic-vector-1703 completed',statusId:done.id});
 const back={...fixture('opened','2026-10-05T04:00:00.000Z'),number:44,pull_request:{...fixture('opened','2026-10-05T04:00:00.000Z').pull_request,number:44,title:completed.identifier,body:null,head:{ref:completed.identifier.toLowerCase()},html_url:'https://github.com/octocat/test-repo1/pull/44'}};
 expect((await send(back)).status).toBe(200);expect(await env.DB.prepare('SELECT status_id FROM issues WHERE id=?').bind(completed.id).first<string>('status_id')).toBe(done.id);
 const branch=await f.create({title:'synthetic-vector-1704 branch only'});
 expect((await send({...back,number:45,pull_request:{...back.pull_request,number:45,title:'synthetic-vector-1705 branch reference',head:{ref:branch.identifier.toLowerCase()+'-work'},html_url:'https://github.com/octocat/test-repo1/pull/45'}})).status).toBe(200);
 expect((await (await f.call('/issues/'+branch.identifier+'/github')).json()) as object).toMatchObject({pullRequests:[{number:45}]});
}

export async function exerciseGithubCommits(f:Awaited<ReturnType<typeof setupIntegrations>>,send:Send){
 const issue=await f.create({title:'synthetic-vector-1720 committed work'}),done=f.initial.teams[0].statuses.find(s=>s.category==='completed')!;
 const authorsBefore=await env.DB.prepare('SELECT count(*) AS n FROM operators').first<number>('n');
 const commits=['b','c'].map((letter,index)=>({id:letter.repeat(40),message:'Fixes '+issue.identifier+' synthetic-vector-172'+index+'\nDetails stay out of the first-line projection.',author:{name:'synthetic-vector-172'+index,email:'synthetic-vector-172'+index+'@example.test'},url:'https://github.com/octocat/test-repo1/commit/'+letter.repeat(40)}));
 const body={ref:'refs/heads/feature',repository:{full_name:'octocat/test-repo1',default_branch:'main'},commits};
 expect((await send(body,crypto.randomUUID(),true,'push')).status).toBe(401);
 expect((await send({...body,repository:{...body.repository,full_name:'synthetic-vector-1724/foreign'}},crypto.randomUUID(),false,'push')).status).toBe(400);
 expect((await send(body,crypto.randomUUID(),false,'push')).status).toBe(200);
 expect(await env.DB.prepare('SELECT status_id FROM issues WHERE id=?').bind(issue.id).first<string>('status_id')).not.toBe(done.id);
 const delivery=crypto.randomUUID(),main={...body,ref:'refs/heads/main'};
 expect((await send(main,delivery,false,'push')).status).toBe(200);
 const linked=await(await f.call('/issues/'+issue.identifier+'/github')).json() as {commits:object[]};
 expect(linked.commits).toHaveLength(2);
 for(const commit of commits)expect(linked.commits).toContainEqual({repository:'octocat/test-repo1',sha:commit.id,author:commit.author.name,subject:commit.message.split('\n')[0],url:commit.url});
 expect(await env.DB.prepare('SELECT status_id FROM issues WHERE id=?').bind(issue.id).first<string>('status_id')).toBe(done.id);
 const moves=()=>env.DB.prepare("SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND kind='issue.status_changed' AND actor_name='Git automation'").bind(issue.id).first<number>('n');
 expect(await moves()).toBe(1);
 expect((await send(main,delivery,false,'push')).status).toBe(200);
 expect((await send(main,crypto.randomUUID(),false,'push')).status).toBe(200);
 expect(await moves()).toBe(1);
 expect(await env.DB.prepare('SELECT count(*) AS n FROM notifications WHERE issue_id=?').bind(issue.id).first<number>('n')).toBe(1);
 expect(await env.DB.prepare('SELECT count(*) AS n FROM operators').first<number>('n')).toBe(authorsBefore);
}

export async function exerciseGithubDeployments(f:Awaited<ReturnType<typeof setupIntegrations>>,send:Send){
 const team=f.initial.teams[0],issue=await f.create({title:'synthetic-vector-1730 deployed work'});
 const statuses=await f.call('/settings/teams/'+team.id+'/statuses','POST',{name:'Shipped',category:'completed'});
 expect(statuses.status).toBe(200);
 const shipped=(await f.state()).teams[0].statuses.find(s=>s.name==='Shipped')!;
 expect((await f.call('/settings/teams/'+team.id,'PATCH',{githubAutomation:{trigger:'deploy',statusId:shipped.id,allowReopen:false,expectedVersion:0,environment:'production'}})).status).toBe(200);
 const push=(before:string,after:string,forced:boolean,commits:object[])=>({ref:'refs/heads/main',before,after,forced,repository:{full_name:'octocat/test-repo1',default_branch:'main'},commits});
 const d='d'.repeat(40),e='e'.repeat(40),unknown='f'.repeat(40);
 const commit={id:d,message:'Fixes '+issue.identifier,author:{name:'synthetic-vector-1731'},url:'https://github.com/octocat/test-repo1/commit/'+d};
 expect((await send(push('a'.repeat(40),d,false,[commit]),crypto.randomUUID(),false,'push')).status).toBe(200);
 expect((await send(push(d,e,false,[]),crypto.randomUUID(),false,'push')).status).toBe(200);
 const deployment=(id:number,sha:string,environment:string,state='success')=>({repository:{full_name:'octocat/test-repo1'},deployment:{id,sha,environment},deployment_status:{state,created_at:'2026-10-11T12:00:00.000Z'}});
 expect((await send(deployment(801,d,'staging'),crypto.randomUUID(),true,'deployment_status')).status).toBe(401);
 expect((await send(deployment(801,d,'staging'),crypto.randomUUID(),false,'deployment_status')).status).toBe(200);
 expect(await env.DB.prepare('SELECT status_id FROM issues WHERE id=?').bind(issue.id).first<string>('status_id')).not.toBe(shipped.id);
 const production=deployment(802,e,'PrOdUcTiOn'),delivery=crypto.randomUUID();
 expect((await send(production,delivery,false,'deployment_status')).status).toBe(200);
 expect(await env.DB.prepare('SELECT status_id FROM issues WHERE id=?').bind(issue.id).first<string>('status_id')).toBe(shipped.id);
 const detail=await(await f.call('/issues/'+issue.identifier)).json() as {version:number;deployments:{environment:string;deployedAt:string}[]};
 expect(detail.deployments.map(d=>d.environment).sort()).toEqual(['PrOdUcTiOn','staging']);
 expect(detail.deployments.every(d=>d.deployedAt==='2026-10-11T12:00:00.000Z')).toBe(true);
 expect((await send(production,delivery,false,'deployment_status')).status).toBe(200);
 expect((await send(production,crypto.randomUUID(),false,'deployment_status')).status).toBe(200);
 expect((await(await f.call('/issues/'+issue.identifier)).json()) as object).toMatchObject({version:detail.version});
 expect(await env.DB.prepare("SELECT count(*) AS n FROM issue_activity WHERE issue_id=? AND json_extract(next_value_json,'$.trigger')='deploy'").bind(issue.id).first<number>('n')).toBe(1);
 expect((await send(deployment(802,d,'PrOdUcTiOn'),crypto.randomUUID(),false,'deployment_status')).status).toBe(409);
 expect((await send(push(e,unknown,true,[]),crypto.randomUUID(),false,'push')).status).toBe(200);
 expect((await send(deployment(803,unknown,'production'),crypto.randomUUID(),false,'deployment_status')).status).toBe(200);
 expect((await send(deployment(804,unknown,'staging','failure'),crypto.randomUUID(),false,'deployment_status')).status).toBe(200);
 expect(await env.DB.prepare('SELECT count(*) AS n FROM github_issue_environments WHERE deployment_id IN(803,804)').first<number>('n')).toBe(0);
 // The first PR-only issue is also included by its retained merge SHA.
 const prOnly=await env.DB.prepare('SELECT id,identifier FROM issues WHERE title=?').bind('synthetic-vector-1701 checkout').first<{id:string;identifier:string}>();
 expect(prOnly).not.toBeNull();
 expect((await send(deployment(805,'a'.repeat(40),'staging'),crypto.randomUUID(),false,'deployment_status')).status).toBe(200);
 const projection=await(await f.call('/issues/'+prOnly!.identifier+'/github')).json() as {deployments:{deploymentId:number}[]};
 expect(projection.deployments.some(d=>d.deploymentId===805)).toBe(true);
}
