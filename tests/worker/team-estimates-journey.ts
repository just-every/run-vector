import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { snapshot } from './role-fixture';
import type { setupAdministration } from './administration-fixture';

type Fixture=Awaited<ReturnType<typeof setupAdministration>>;
/** Native issue, Settings, options, Current and bulk doors share numeric custody. */
export async function teamEstimatesJourney(f:Fixture,team:Fixture['initial']['teams'][number]) {
  const path='/settings/teams/'+team.id;
  const started=team.statuses.find(status=>status.category==='started')!.id;
  let issue=await f.create({teamId:team.id,statusId:started,estimate:34});
  const stored=()=>env.DB.prepare('SELECT estimate FROM issues WHERE id=?').bind(issue.id).first<number>('estimate');
  const detail=async()=>await (await f.call('/issues/'+issue.identifier)).json() as any;
  const current=async()=>((await (await f.call('/current')).json()) as any).sections.now.find((row:any)=>row.identifier===issue.identifier);
  for(const [scale,value,label] of [['tshirt',5,'L (5 points)'],['fibonacci',21,'21 points'],['exponential',32,'32 points']] as const) {
    await f.mutate(path,'PATCH',{estimateScale:scale});
    expect(await stored()).toBe((await detail()).estimate);
    const options=await (await f.call('/options')).json() as any;
    expect(options.teams.find((row:any)=>row.id===team.id)).toMatchObject({estimatesEnabled:true,estimateScale:scale});
    const receipt=await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:(await detail()).version,estimate:value});
    expect(receipt.status,await receipt.clone().text()).toBe(200);
    expect(await stored()).toBe(value);expect((await current()).estimateLabel).toBe(label);
    const before=await snapshot(['issues','issue_activity','audit_records']);
    expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:(await detail()).version,estimate:7})).status).toBe(400);
    expect((await f.call('/issues','POST',{teamId:team.id,title:'synthetic-vector-2601',estimate:7})).status).toBe(400);
    expect((await f.call('/issues/bulk','POST',{issues:[{identifier:issue.identifier,expectedVersion:(await detail()).version}],changes:{estimate:7}})).status).toBe(409);
    expect(await snapshot(['issues','issue_activity','audit_records'])).toEqual(before);
  }
  const other=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-2602',identifierPrefix:'SYNEST'})).teams.find(row=>row.identifierPrefix==='SYNEST')!;
  const independent=await f.create({teamId:other.id,estimate:7,statusId:other.statuses.find(status=>status.category==='started')!.id});
  const retained=await snapshot(['issues','issue_activity','cycle_snapshots','cycle_membership_events']);
  await f.mutate(path,'PATCH',{estimatesEnabled:false});
  expect((await f.state()).teams.find(row=>row.id===team.id)).toMatchObject({estimatesEnabled:false,estimateScale:'exponential'});
  expect(await snapshot(['issues','issue_activity','cycle_snapshots','cycle_membership_events'])).toEqual(retained);
  expect(await current()).toMatchObject({estimate:null,estimateLabel:null});
  const before=await snapshot(['issues','issue_activity','audit_records']);
  for(const estimate of [null,2]) {
    expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:(await detail()).version,estimate})).status).toBe(400);
    expect((await f.call('/issues/bulk','POST',{issues:[{identifier:issue.identifier,expectedVersion:(await detail()).version}],changes:{estimate}})).status).toBe(409);
  }
  expect((await f.call('/issues','POST',{teamId:team.id,title:'synthetic-vector-2603',estimate:2})).status).toBe(400);
  expect(await snapshot(['issues','issue_activity','audit_records'])).toEqual(before);
  const unrelated=await (await f.call('/current')).json() as any;
  expect(unrelated.sections.now.find((row:any)=>row.identifier===independent.identifier).estimateLabel).toBe('7 points');
  expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:(await detail()).version,title:'synthetic-vector-2604'})).status).toBe(200);
  expect(await stored()).toBe(32);
  await f.mutate(path,'PATCH',{estimatesEnabled:true,estimateScale:'tshirt'});
  expect((await current()).estimateLabel).toBe('32 points (retained)');
  expect((await f.call('/issues/bulk','POST',{issues:[{identifier:issue.identifier,expectedVersion:(await detail()).version}],changes:{estimate:3}})).status).toBe(200);
  expect(await stored()).toBe(3);expect((await current()).estimateLabel).toBe('M (3 points)');
}
