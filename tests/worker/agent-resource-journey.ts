import {expect} from 'vitest';
import {createServerApp} from '../../src/core/app/server';
import {agentResponse} from '../../src/core/features/agent-door/runtime';
import {bindings,origin} from './base-auth-fixture';
import type {Person} from './role-fixture';

/** Mounted transport, including the pre-cookie MCP admission used by the Worker. */
export async function agentRequest(path:string,init:RequestInit) {
  const app=createServerApp();
  const headers=new Headers(init.headers);
  headers.set('Host',new URL(origin).host);
  const request=new Request(origin+path,{...init,headers});
  return await agentResponse(bindings,request) ?? app.request(request,undefined,bindings);
}

/** The existing private-team journey also crosses the mounted MCP door. */
export async function agentResourceClient(member:Person,owner:Person) {
  const send=agentRequest;
  const policy=await send('/agents/api/policy',{
    method:'PUT',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},
    body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'all',class:'*',do:'autonomous'}],spend:{none:true}}}),
  });
  expect(policy.status,await policy.clone().text()).toBe(200);
  const issue=async(scopes:string[])=>{
    const response=await member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-3301',scopes});
    expect(response.status).toBe(201);
    return (await response.json() as {token:string}).token;
  };
  const evidence=await issue(['evidence:read','issues:write','comments:write']),noEvidence=await issue(['issues:read']);
  let id=0;
  const rpc=async(method:string,params:object,token=evidence)=>{
    const response=await send('/mcp',{
      method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method},
      body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),
    });
    return {status:response.status,body:await response.json() as any,challenge:response.headers.get('www-authenticate')};
  };
  const read=async(uri:string)=>rpc('resources/read',{uri});
  return {
    async hidden(uri:string,title:string) {
      const response=await read(uri);
      expect(response.body.error?.data?.code).toBe('resource_unavailable');
      expect(response.body.result).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain(title);
    },
    async visible(uri:string,identifier:string) {
      const response=await read(uri);
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const content=response.body.result.contents[0];
      expect(content.uri).toBe(uri);
      expect(content._meta['com.runeditrun/untrusted']).toBe(true);
      expect(JSON.parse(content.text).identifier).toBe(identifier);
    },
    async write(teamId:string) {
      const created=await rpc('tools/call',{name:'vector.intake.intake_creation',arguments:{teamId,title:'synthetic-vector-3302',summary:'synthetic-vector-3303',idempotency_key:crypto.randomUUID()}});
      expect(created.status).toBe(200);
      expect(created.body.result?.isError).not.toBe(true);
      const result=created.body.result.structuredContent;
      const link=created.body.result.content.find((item:any)=>item.type==='resource_link');
      expect(link).toMatchObject({uri:'vector://issue/'+result.id,name:result.identifier});
      const returned=await read(link.uri);
      expect(returned.status).toBe(200);
      const record=JSON.parse(returned.body.result.contents[0].text);
      expect(record).toMatchObject({id:result.id,identifier:result.identifier,title:'synthetic-vector-3302'});
      expect(record.evidence).toEqual(expect.arrayContaining([expect.objectContaining({summary:'synthetic-vector-3303',originKind:'operator'})]));
      const commented=await rpc('tools/call',{name:'vector.issue.comment',arguments:{identifier:result.identifier,body:'synthetic-vector-3305',idempotency_key:crypto.randomUUID()}});
      expect(commented.status).toBe(200);
      expect(commented.body.result?.isError).not.toBe(true);
      const commentLink=commented.body.result.content.find((item:any)=>item.uri==='vector://comment/'+commented.body.result.structuredContent.commentId);
      expect(commentLink).toMatchObject({type:'resource_link',name:result.identifier+' comment'});
      const commentRead=await read(commentLink.uri);
      expect(commentRead.status).toBe(200);
      expect(JSON.parse(commentRead.body.result.contents[0].text)).toMatchObject({id:commented.body.result.structuredContent.commentId,body:'synthetic-vector-3305',canEdit:1});
      expect(commentRead.body.result.contents[0]._meta['com.runeditrun/untrusted']).toBe(true);
      for(const uri of [link.uri,commentLink.uri]){
        const refused=await rpc('resources/read',{uri},noEvidence);
        expect(refused.status).toBe(403);
        expect(refused.body.error.data.code).toBe('insufficient_scope');
        expect(refused.challenge).toContain('evidence:read');
        expect(refused.body.result).toBeUndefined();
      }
      return [link.uri,commentLink.uri] as string[];
    },
  };
}

/** One native job under both dispositions; no projection or provider fake. */
export async function projectReadJourney(w:Awaited<ReturnType<typeof import('./role-fixture').roleWorkspace>>) {
  const {env}=await import('cloudflare:workers');
  const {snapshot}=await import('./role-fixture');
  const {validateSchema}=await import('../../vendor/base/agent-door/json-schema');
  const {scheduled}=await import('../../src/core/app/scheduled');
  const json=async(response:Response,status=200):Promise<any>=>{
    expect(response.status,await response.clone().text()).toBe(status);return response.json();
  };
  const owner=w.people.owner, member=w.member;
  const project=(await w.mutate('/settings/projects','POST',{
    name:'synthetic-vector-3501',description:'synthetic-vector-3502',leadOperatorId:owner.id,
    startDate:'2030-09-01',targetDate:'2099-01-01',
  })).projects.find(p=>p.name==='synthetic-vector-3501')!;
  await w.mutate('/settings/projects/'+project.id,'PATCH',{lifecycle:'active'});
  const cycle=(await w.mutate('/settings/cycles','POST',{teamId:w.team.id,name:'synthetic-vector-3503',
    startsLocal:'2030-09-01T00:00',endsLocal:'2030-09-08T00:00',capacity:8})).cycles.find(c=>c.name==='synthetic-vector-3503')!;
  await w.mutate(`/settings/projects/${project.id}/milestones`,'POST',{name:'synthetic-vector-3504',description:'synthetic-vector-3505'});
  const first=await w.create({teamId:w.team.id,projectId:project.id,cycleId:cycle.id,title:'synthetic-vector-3506'});
  await json(await owner.call('/issues/'+first.identifier,'PATCH',{expectedVersion:first.version,statusId:w.team.statuses.find(s=>s.category==='completed')!.id}));
  await w.create({teamId:w.team.id,projectId:project.id,title:'synthetic-vector-3507'});
  await scheduled({scheduledTime:Date.parse('2030-09-09T00:00:00Z')},bindings);
  const team=(await w.mutate('/settings/teams','POST',{name:'synthetic-vector-3508',identifierPrefix:'SYNPREAD',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-3508')!;
  const hidden=(await w.mutate('/settings/projects','POST',{name:'synthetic-vector-3509',leadOperatorId:owner.id})).projects.find(p=>p.name==='synthetic-vector-3509')!;
  await w.create({teamId:team.id,projectId:hidden.id,title:'synthetic-vector-3510'});
  const secret=await w.create({teamId:team.id,projectId:project.id,title:'synthetic-vector-3515'});
  // A real second installation owns this identity; the first installation has no authority over it.
  const {applyD1Migrations}=await import('cloudflare:test');
  const {inject}=await import('vitest');
  const {bootstrapWorkspace}=await import('../../src/core/features/bootstrap/repository');
  const foreignDb=env.ARCHIVE_TARGET_DB;
  await applyD1Migrations(foreignDb,inject('migrations'));
  await bootstrapWorkspace(foreignDb,bindings);
  const installation=await foreignDb.prepare('SELECT workspace_id,setup_operator_id FROM workspace_installation').first<{workspace_id:string;setup_operator_id:string}>();
  const foreign='00000000000000000000003512';
  await foreignDb.prepare(`INSERT INTO projects(id,workspace_id,name,description,lead_operator_id,lifecycle,created_at,updated_at)
    VALUES(?,?,'synthetic-vector-3512','',?,'planned',datetime('now'),datetime('now'))`).bind(foreign,installation!.workspace_id,installation!.setup_operator_id).run();
  let serial=0;
  const mint=async(person:Person,scopes=['projects:read'])=>{
    const grant=await json(await person.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-3513',scopes}),201);
    return {id:grant.credential.id,async rpc(method:string,params:object){
      const response=await agentRequest('/mcp',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+grant.token,
        'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method},
        body:JSON.stringify({jsonrpc:'2.0',id:++serial,method,params})});
      return {status:response.status,body:await response.json() as any};
    },read(projectId:string,at='2030-09-09T12:00:00Z'){return this.rpc('tools/call',{name:'vector.project.read',arguments:{projectId,at}});}};
  };
  const readers=await Promise.all([mint(owner),mint(member)]),insufficient=await mint(member,['issues:read']);
  const tables=['projects','project_milestones','project_activity','project_membership_events','issues','issue_activity','cycle_snapshots','audit_records'];
  for(const disposition of ['autonomous','review']){
    await json(await agentRequest('/agents/api/policy',{method:'PUT',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},
      body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'standard',class:'standard',do:disposition}],...(disposition==='review'?{reviewers:['sponsor']} : {}),spend:{none:true}}})}));
    const unchanged=await snapshot(tables);
    const listed=await readers[0].rpc('tools/list',{});
    expect(listed.status).toBe(200);
    const tool=listed.body.result.tools.find((tool:any)=>tool.name==='vector.project.read');
    expect(tool.annotations).toEqual({readOnlyHint:true,destructiveHint:false,openWorldHint:false});
    expect(tool._meta['com.runeditrun/scope']).toBe('projects:read');
    for(const [index,person] of [owner,member].entries()){
      const native=await json(await person.call(`/projects/${project.id}?at=2030-09-09T12:00:00Z`));
      const read=await readers[index].read(project.id);
      expect(read.status).toBe(200);
      expect(read.body.result.isError).toBe(false);
      expect(read.body.result.structuredContent).toEqual(native);
      expect(validateSchema(tool.outputSchema,read.body.result.structuredContent)).toBe(true);
      expect(read.body.result._meta['com.runeditrun/untrusted']).toBe(true);
      expect(read.body.result._meta['com.runeditrun/decision'].disposition).toBe(disposition);
      if(disposition==='review')expect(read.body.result._meta['com.runeditrun/review']).toBeTruthy();
      expect(native.progress).toEqual({completed:1,total:index===0?3:2,percentage:index===0?33:50});
      expect(native.issues.some((issue:any)=>issue.id===secret.id)).toBe(index===0);
      const broken={...read.body.result.structuredContent};delete broken.health;
      expect(validateSchema(tool.outputSchema,broken)).toBe(false);
      expect(native.health).toBe('on-track');
      expect(native.milestones).toEqual([expect.objectContaining({name:'synthetic-vector-3504'})]);
      expect(native.cycleHistory[0].snapshot.completed).toContain(first.identifier);
      expect(native.activity).toEqual(expect.arrayContaining([expect.objectContaining({kind:'project.updated'})]));
    }
    for(const projectId of [hidden.id,foreign,'00000000000000000000000000']){
      const native=await json(await member.call('/projects/'+projectId),404);
      const refused=await readers[1].read(projectId);
      expect(refused.body.result.isError).toBe(true);
      expect(refused.body.result._meta['com.runeditrun/error'].code).toBe(native.error);
      expect(refused.body.result.structuredContent).toBeUndefined();
      expect(JSON.stringify(refused.body)).not.toContain('synthetic-vector-3510');
    }
    expect((await json(await member.call('/projects/bad'),400)).error).toBe('invalid_request');
    const malformed=await readers[1].read('bad');
    expect(malformed.body.result._meta['com.runeditrun/error'].code).toBe('invalid_arguments');
    const wrongScope=await insufficient.read(project.id);
    expect(wrongScope.status).toBe(403);
    expect(wrongScope.body.error.data.code).toBe('insufficient_scope');
    expect(await snapshot(tables)).toEqual(unchanged);
    await w.mutate(`/settings/teams/${team.id}/members/${member.id}`,'PUT',{role:'member'});
    const native=await json(await member.call(`/projects/${hidden.id}?at=2030-09-09T12:00:00Z`));
    expect((await readers[1].read(hidden.id)).body.result.structuredContent).toEqual(native);
    await w.mutate(`/settings/teams/${team.id}/members/${member.id}`,'DELETE');
    const withdrawn=await snapshot(tables);
    const denied=await readers[1].read(hidden.id);
    expect(denied.body.result._meta['com.runeditrun/error'].code).toBe('not_found');
    expect(denied.body.result.structuredContent).toBeUndefined();
    expect(await snapshot(tables)).toEqual(withdrawn);
    const revoked=await mint(member);
    expect((await revoked.read(project.id)).body.result.isError).toBe(false);
    await json(await member.call('/settings/integrations/tokens/'+revoked.id,'DELETE'));
    const afterRevocation=await snapshot(tables);
    expect((await revoked.read(project.id)).status).toBe(401);
    expect(await snapshot(tables)).toEqual(afterRevocation);
    const rows=(await env.DB.prepare("SELECT row FROM agent_door_audit WHERE json_extract(row,'$.tool')='vector.project.read' ORDER BY sequence").all<{row:string}>()).results.map(r=>JSON.parse(r.row));
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({outcome:'done',resource:{kind:'project',id:project.id},sponsor:expect.objectContaining({id:member.id})}),expect.objectContaining({outcome:'refused',code:'not_found'})]));
  }
}
