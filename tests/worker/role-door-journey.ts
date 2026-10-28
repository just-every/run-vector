import {expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {createServerApp} from '../../src/core/app/server';
import {doors} from '../../src/core/features/roles/doors';
import {resetLimits,snapshot,type roleWorkspace} from './role-fixture';
type Workspace=Awaited<ReturnType<typeof roleWorkspace>>;

export async function unregisteredAndSettingsJourney(w:Workspace){
 const owner=w.people.owner;
 const business=['issues','operators','workspace_settings','team_members'];
 const before=await snapshot(business);
 for(const person of [w.admin,w.lead,w.member,w.guest]){
  await resetLimits();
  const count=await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE action='permission.unregistered_refused' AND actor_operator_id=?").bind(person.id).first<number>('n');
  expect((await person.call('/synthetic-vector-32001','POST',{private:'synthetic-vector-32002'})).status).toBe(403);
  const audit=await env.DB.prepare("SELECT a.actor_operator_id,d.next_value_json FROM audit_records a JOIN administration_audit_details d ON d.audit_id=a.id WHERE a.action='permission.unregistered_refused' AND a.actor_operator_id=? ORDER BY a.id DESC").bind(person.id).all();
  expect(audit.results).toHaveLength(count!+1);
  expect(JSON.parse(String(audit.results[0].next_value_json))).toEqual({method:'POST',surface:'api'});
  expect(JSON.stringify(audit.results)).not.toContain('synthetic-vector-32002');
  const visible=await owner.call('/settings/audit?'+new URLSearchParams({action:'permission.unregistered_refused',actor:'person:'+person.id}));
  expect(visible.status).toBe(200);
  const entries=(await visible.json() as {entries:{action:string;actorRef:string;subjectRef:string}[]}).entries;
  expect(entries).toHaveLength(count!+1);
  expect(entries.every(entry=>entry.action==='permission.unregistered_refused'&&entry.actorRef==='person:'+person.id&&entry.subjectRef==='unregistered')).toBe(true);
 }
 expect((await owner.call('/synthetic-vector-32001','POST',{})).status).toBe(404);
 expect(await snapshot(business)).toEqual(before);
 const routes=createServerApp().routes.filter(route=>route.method!=='ALL'&&(route.path==='/api/settings'||route.path.startsWith('/api/settings/')));
 expect(routes.length).toBeGreaterThan(0);
 for(const route of routes){
  await resetLimits();
  const path=route.path.slice(4).replace(/:teamId|:id/g,w.team.id).replace(/:operatorId/g,w.member.id);
  const registration=doors.find(door=>door.method===route.method&&'/api'+door.path===route.path);
  expect(registration,route.path+' Settings page has a permission declaration').toBeDefined();
  if(registration?.page==='account'&&route.method!=='GET')continue; // Own Account mutations have their populated journey.
  const response=await w.guest.call(path,route.method,route.method==='GET'?undefined:{});
  expect(response.status,'Guest '+route.method+' '+route.path+' '+await response.clone().text()).toBe(registration?.page==='account'?200:403);
 }
}
