import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { roleWorkspace, resetLimits, snapshot } from './role-fixture';

it('fleet diagnostic: root Member 403 / Owner 200; child creation 400; hierarchy absent 404', {timeout:120_000}, async () => {
  const w = await roleWorkspace();
  const path = `/settings/teams/${w.team.id}`;
  const owner = w.people.owner;
  expect((await owner.call(path+'/permissions', 'PUT', {settings:'all_members',planning:'team_owners'})).status).toBe(200);
  expect((await w.member.call(`/teams/${w.team.id}/join`, 'POST', {})).status).toBe(200);
  const before = await snapshot(['teams','team_members','audit_records','administration_audit_details']);
  const status = (await w.member.call(path+'/permissions','PUT',{settings:'all_members',planning:'all_members'})).status;
  console.log(`REPRO root permission door: ${status}`);
  expect(status).toBe(403);
  for (const next of [
    {settings:'team_owners',planning:'team_owners'},
    {settings:'all_members',planning:'all_members'},
    {settings:'team_owners',planning:'all_members'},
    {settings:'all_members',planning:'team_owners'},
  ]) expect((await w.member.call(path+'/permissions','PUT',next)).status).toBe(403);
  expect((await w.member.call(path+'/privacy','PUT',{isPrivate:true})).status).toBe(403);
  expect((await w.member.api(`/teams/${w.team.id}/privacy`,'PUT',{isPrivate:true})).status).toBe(403);
  expect(await snapshot(['teams','team_members','audit_records','administration_audit_details'])).toEqual(before);
  const nativeCreate = await owner.call('/settings/teams','POST',{name:'Fleet child probe',identifierPrefix:'FLEETCH',parentTeamId:w.team.id});
  console.log(`REPRO child creation with parentTeamId: ${nativeCreate.status}`);
  expect(nativeCreate.status).toBe(400);
  const hierarchy = await owner.call(path+'/hierarchy','PUT',{parentTeamId:null});
  console.log(`REPRO hierarchy door (Owner): ${hierarchy.status}`);
  expect(hierarchy.status).toBe(404);
  const columns = (await env.DB.prepare('PRAGMA table_info(teams)').all<{name:string}>()).results.map(row=>row.name);
  console.log(`REPRO parent_team_id schema column present: ${columns.includes('parent_team_id')}`);
  expect(columns).not.toContain('parent_team_id');
  await resetLimits();
  expect((await w.member.call(path,'PATCH',{planningPermission:'all_members'})).status).toBe(400);
  expect((await w.member.call(path,'PATCH',{isPrivate:true})).status).toBe(400);
  expect((await owner.api('/teams','POST',{name:'Fleet API child probe',identifierPrefix:'FLEETAPI',parentTeamId:w.team.id})).status).toBe(400);
  expect((await owner.call('/settings/teams/creation','PUT',{membersMayCreate:true})).status).toBe(200);
  expect((await w.member.call('/settings/teams','POST',{name:'Fleet native private probe',identifierPrefix:'FLEETNPR',isPrivate:true})).status).toBe(403);
  const apiPrivate=await w.member.api('/teams','POST',{name:'Fleet private probe',identifierPrefix:'FLEETPR',isPrivate:true});
  expect(apiPrivate.status).toBe(403);
  const allowed = (await owner.call(path+'/permissions','PUT',{settings:'all_members',planning:'all_members'})).status;
  console.log(`PROBE root permission door: Member -> ${status}; Owner -> ${allowed}`);
  expect(allowed).toBe(200);
  expect((await owner.call(path+'/privacy','PUT',{isPrivate:true})).status).toBe(200);
  expect((await owner.api(`/teams/${w.team.id}/privacy`,'PUT',{isPrivate:false})).status).toBe(200);
});
