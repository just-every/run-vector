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
