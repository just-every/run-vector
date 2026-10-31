import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { setupAdministration } from './administration-fixture';
import { snapshot } from './role-fixture';

export async function teamTriageJourney(f:Awaited<ReturnType<typeof setupAdministration>>,teamId:string) {
  const path='/settings/teams/'+teamId;
  const intake=async(title:string)=>{
    const response=await f.call('/intake','POST',{teamId,title,description:'synthetic-vector-2610',summary:'synthetic-vector-2611'});
    expect(response.status,await response.clone().text()).toBe(201);return await response.json() as any;
  };
  const pending=await intake('synthetic-vector-2612');
  const deferred=await intake('synthetic-vector-2613');
  expect((await f.call('/issues/'+deferred.identifier+'/defer','POST',{expectedVersion:deferred.version,returnAt:'2040-01-01T00:00:00Z',reason:'synthetic-vector-2614'})).status).toBe(200);
  const current=async()=>await (await f.call('/current')).json() as any;
  expect((await current()).sections['needs-decision'].map((row:any)=>row.identifier)).toContain(pending.identifier);
  const tables=['issues','evidence_revisions','intake_decisions','issue_activity','issue_deferral_origins'];
  const before=await snapshot(tables);
  await f.mutate(path,'PATCH',{triageEnabled:false});
  expect((await f.state()).teams.find(team=>team.id===teamId)?.triageEnabled).toBe(false);
  expect(await snapshot(tables)).toEqual(before);
  expect((await current()).sections['needs-decision'].map((row:any)=>row.identifier)).not.toContain(pending.identifier);
  const refused=await snapshot([...tables,'notifications']);
  for(const verb of ['accept','decline','defer']) {
    const response=await f.call('/issues/'+pending.identifier+'/'+verb,'POST',{expectedVersion:pending.version,reason:'synthetic-vector-2615',...(verb==='defer'?{returnAt:'2040-01-01T00:00:00Z'}:{})});
    expect(response.status,await response.clone().text()).toBe(409);
  }
  expect(await snapshot([...tables,'notifications'])).toEqual(refused);
  const bypass=await intake('synthetic-vector-2616');
  expect(bypass.status.category).toBe('backlog');expect(bypass.evidence).toHaveLength(1);expect(bypass.evidence[0].summary).toBe('synthetic-vector-2611');
  expect(await env.DB.prepare('SELECT count(*) n FROM intake_decisions WHERE issue_id=?').bind(bypass.id).first('n')).toBe(0);
  const {returnDueIntake}=await import('../../src/core/features/intake-return/service');
  const retained=await snapshot(tables);
  await returnDueIntake({DB:env.DB},new Date('2040-01-02T00:00:00Z'));
  expect(await snapshot(tables)).toEqual(retained);
  await f.mutate(path,'PATCH',{triageEnabled:true});
  expect((await current()).sections['needs-decision'].map((row:any)=>row.identifier)).toContain(pending.identifier);
  const resumed=await intake('synthetic-vector-2617');expect(resumed.status.category).toBe('intake');
  const returned=await returnDueIntake({DB:env.DB},new Date('2040-01-02T00:00:00Z'));expect(returned.returned).toBeGreaterThan(0);
  expect(await env.DB.prepare('SELECT deferred_until FROM issues WHERE id=?').bind(deferred.id).first('deferred_until')).toBeNull();
}
