import { env } from 'cloudflare:workers';
import { expect,vi } from 'vitest';
import { setupIntegrations } from './integration-fixture';
import { request,invite,actor,bindings,origin } from './base-auth-fixture';
import seed from '../../seed.json';
/** Current native Settings, issue, audit and session doors; only the provider edge is synthetic. */
export async function modelPolicyJourney(f:Awaited<ReturnType<typeof setupIntegrations>>) {
  const calls:{url:string;body:any}[]=[];
  let beforeReply:(()=>Promise<void>)|undefined;
  const edge={async send(wire:{url:string;body:string}){calls.push({url:wire.url,body:JSON.parse(wire.body)});if(beforeReply){const run=beforeReply;beforeReply=undefined;await run();}return {status:200,headers:{},body:JSON.stringify({content:[{type:'text',text:'synthetic-vector-4801: review this intake before accepting.'}]})};}};
  const overrides={INTEGRATION_EGRESS:edge,INTEGRATION_EGRESS_POLICY:'public-dns-pinned-tls-v1'};
  const call=(path:string,method='GET',body?:unknown,cookie=f.cookie)=>request('/api'+path,method,body,cookie,overrides);
  const read=async(path:string,method='GET',body?:unknown,cookie=f.cookie,status=200)=>{
    const response=await call(path,method,body,cookie);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;
  };
  const state=()=>read('/settings/models');
  const issue=await f.create({title:'synthetic-vector-4801',description:'synthetic-vector-4801 intake content'});
  const preview=(target=issue.identifier,cookie=f.cookie)=>read('/issues/'+target+'/triage-suggestion','POST',{},cookie);
  expect(await preview()).toEqual({enabled:false});expect(calls).toHaveLength(0);
  const admin=await invite(['synthetic-vector-4802','vector.test'].join('@'),f.cookie,'admin');
  const member=await invite(['synthetic-vector-4803','vector.test'].join('@'),f.cookie);
  const memberId=await actor(member);
  const profile={name:'synthetic-vector-4804',kind:'self-hosted',endpoint:'https://synthetic-vector-4804.example.test/messages',model:'synthetic-vector-4804',credential:'synthetic-vector-4804-credential'};
  const custom=await read('/settings/models/providers','POST',profile,admin,201);
  const policy={feature:'triage',teamId:null,enabled:true,providerId:custom.id};
  const snapshot=async()=>({settings:await state(),keys:(await env.DB.prepare('SELECT * FROM vector_integration_secret_keys ORDER BY identity').all()).results,issues:(await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results,audit:(await env.DB.prepare("SELECT * FROM audit_records WHERE action LIKE 'model.%' ORDER BY id").all()).results});
  const before=await snapshot();
  await read('/settings/models/policy','PUT',policy,admin,409);
  await read('/settings/models/providers/'+custom.id+'/confirm','POST',{termsUrl:'https://synthetic-vector-4804.example.test/terms',retention:'No retention',noTraining:true},admin,403);
  await read('/settings/models/providers/'+custom.id+'/confirm','POST',{termsUrl:'https://synthetic-vector-4804.example.test/terms',retention:'No retention',noTraining:false},f.cookie,400);
  expect(await snapshot()).toEqual(before);expect(calls).toHaveLength(0);
  await read('/settings/models/providers/'+custom.id+'/confirm','POST',{termsUrl:'https://synthetic-vector-4804.example.test/terms',retention:'No retention',noTraining:true});
  const confirmed=(await state()).providers.find((p:any)=>p.id===custom.id);
  expect(confirmed).toMatchObject({noTraining:true,termsUrl:'https://synthetic-vector-4804.example.test/terms',retention:'No retention',data:['issue identifier','issue title','issue description']});
  expect(confirmed.confirmedAt).toBeTruthy();
  const audit=await read('/settings/audit?action=model.terms_confirmed');
  expect(audit.entries).toContainEqual(expect.objectContaining({action:'model.terms_confirmed',actorRef:'person:'+f.owner,subjectRef:custom.id}));
  expect(JSON.stringify(await state())).not.toContain(profile.credential);
  expect(JSON.stringify((await env.DB.prepare('SELECT * FROM vector_integration_secret_keys').all()).results)).not.toContain(profile.credential);
  for(const feature of ['triage','semantic-search','ask','drafting'])await read('/settings/models/policy','PUT',{...policy,feature},admin);
  const issueBefore=await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first();
  const served=await preview();expect(served).toMatchObject({enabled:true,suggestion:expect.stringContaining('synthetic-vector-4801'),records:[issue.identifier]});expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body.messages[0].content)).toEqual({feature:'triage',records:[{identifier:issue.identifier,title:'synthetic-vector-4801',description:'synthetic-vector-4801 intake content'}]});
  expect(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first()).toEqual(issueBefore);
  await read('/settings/models/policy','PUT',{...policy,teamId:f.initial.teams[0].id,enabled:false},admin);
  expect(await preview()).toEqual({enabled:false});expect(calls).toHaveLength(1);
  const teamState=await f.mutate('/settings/teams','POST',{name:'synthetic-vector-4805',identifierPrefix:'MODEL'});
  const other=teamState.teams.find(t=>t.name==='synthetic-vector-4805')!;
  const otherIssue=await f.create({teamId:other.id,title:'synthetic-vector-4805'});
  expect((await preview(otherIssue.identifier)).enabled).toBe(true);expect(calls).toHaveLength(2);
  await read('/settings/models/policy','PUT',{...policy,teamId:other.id},admin);
  await read('/settings/models/policy','PUT',{...policy,enabled:false},admin);
  expect(await preview(otherIssue.identifier)).toEqual({enabled:false});expect(calls).toHaveLength(2);
  await read('/settings/models/policy','PUT',policy,admin);
  expect((await preview(otherIssue.identifier,member)).enabled).toBe(true);expect(calls).toHaveLength(3);
  beforeReply=async()=>{const changed=await f.call('/issues/'+otherIssue.identifier,'PATCH',{expectedVersion:otherIssue.version,description:'synthetic-vector-4807 corrected source'});expect(changed.status).toBe(200);};
  const stale=await read('/issues/'+otherIssue.identifier+'/triage-suggestion','POST',{},f.cookie,409);expect(stale.error).toBe('model_source_changed');otherIssue.version++;
  await f.mutate('/settings/teams/'+other.id+'/privacy','PUT',{isPrivate:true});
  const count=calls.length;
  await read('/issues/'+otherIssue.identifier+'/triage-suggestion','POST',{},member,404);expect(calls).toHaveLength(count);
  await f.mutate('/settings/teams/'+other.id+'/members/'+memberId,'PUT',{role:'member'});
  expect((await preview(otherIssue.identifier,member)).enabled).toBe(true);expect(calls).toHaveLength(count+1);
  await f.mutate('/settings/teams/'+other.id+'/members/'+memberId,'DELETE');
  await read('/issues/'+otherIssue.identifier+'/triage-suggestion','POST',{},member,404);expect(calls).toHaveLength(count+1);
  await read('/settings/models','GET',undefined,member,403);
  // A revoked native session cannot invoke the model door again.
  const signedOut=await request('/auth/signout','POST',{},member);expect(signedOut.status).toBe(204);
  await read('/issues/'+issue.identifier+'/triage-suggestion','POST',{},member,401);expect(calls).toHaveLength(count+1);
  await read('/settings/models/providers/'+custom.id,'DELETE');
  expect(await env.DB.prepare('SELECT encrypted FROM vector_integration_secret_keys WHERE identity=?').bind('model:'+custom.id).first()).toBeNull();
  expect(await preview(otherIssue.identifier)).toEqual({enabled:false});expect(calls).toHaveLength(count+1);
  // The declared provider is actually enabled and exercised, so this is not an empty-inventory check.
  const native=await read('/settings/models/providers','POST',{...profile,name:'synthetic-vector-4806',kind:'anthropic',endpoint:'https://api.anthropic.com/v1/messages'},f.cookie,201);
  await read('/settings/models/policy','PUT',{...policy,providerId:native.id});
  const disclosed=(await state()).providers.find((p:any)=>p.id===native.id),declaration=seed.externals.find(p=>p.id==='anthropic-model-api')!;
  expect(disclosed).toMatchObject({termsUrl:declaration.termsUrl,noTraining:true,retention:declaration.retention,data:declaration.data});
  expect(new URL(disclosed.termsUrl).protocol).toBe('https:');expect(disclosed.data.length).toBeGreaterThan(0);expect(declaration.noTrainingStatement.length).toBeGreaterThan(0);
  const network=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages');expect(init?.redirect).toBe('manual');
    return Response.json({content:[{type:'text',text:'synthetic-vector-4806'}]});
  });
  try{expect((await preview(otherIssue.identifier)).suggestion).toBe('synthetic-vector-4806');expect(network).toHaveBeenCalledTimes(1);}
  finally{network.mockRestore();}
  await read('/settings/models/providers/'+native.id,'DELETE');
  const removed=await f.call('/issues/'+otherIssue.identifier,'DELETE',{expectedVersion:otherIssue.version,confirmed:true});expect(removed.status).toBe(200);
  await read('/issues/'+otherIssue.identifier+'/triage-suggestion','POST',{},f.cookie,404);
  await read('/issues/'+otherIssue.identifier+'/triage-suggestion','POST',{},f.cookie,404);
  expect(calls).toHaveLength(count+1);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
