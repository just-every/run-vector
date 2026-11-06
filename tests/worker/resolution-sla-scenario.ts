import { env } from 'cloudflare:workers';
import { expect,vi } from 'vitest';
import type { setupAdministration } from './administration-fixture';
import { bindings,request,invite,actor,confirm,mailToken } from './base-auth-fixture';
import { channelEdge } from './channel-edge-fixture';
import { scheduled } from '../../src/core/app/scheduled';
import { dispatchWebhooks } from '../../src/core/features/integrations/outbound';
import { createServerApp } from '../../src/core/app/server';
import { readArchive } from '@runeditrun/rer/modules/portability';
export async function resolutionSlaJourney(base:Awaited<ReturnType<typeof setupAdministration>>) {
  const bobCookie=await invite(['synthetic-vector-196','vector.test'].join('@'),base.cookie),bob=await actor(bobCookie);
  const caraCookie=await invite(['synthetic-vector-197','vector.test'].join('@'),base.cookie),cara=await actor(caraCookie);
  const f={...base,bob,bobCookie,cara,caraCookie,any:(cookie:string,path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,cookie)};
  const adminCookie=await invite(['synthetic-vector-193','vector.test'].join('@'),f.cookie,'admin');
  const viewerCookie=await invite(['synthetic-vector-194','vector.test'].join('@'),f.cookie,'viewer');
  const guestAddress=['synthetic-vector-195','vector.test'].join('@');
  expect((await f.call('/settings/operators/invite','POST',{email:guestAddress,displayName:'synthetic-vector-195',role:'guest',teamIds:[f.initial.teams[0].id]})).status).toBe(202);
  const guestCookie=await confirm(await mailToken(guestAddress));
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date('2026-10-30T20:00:00Z'));
  const edge=channelEdge();
  try{
    const team=f.initial.teams[0],path=`/settings/teams/${team.id}/sla`;
    const rule={enabled:true,priority:'urgent',labelId:null,targetMinutes:120,warnBeforeMinutes:30,workingDays:[1,2,3,4,5],startsAt:'09:00',endsAt:'17:00'};
    expect((await f.call('/settings','PATCH',{timezone:'America/New_York'})).status).toBe(200);
    const configure=async(patch={})=>{const response=await f.call(path,'PUT',{...rule,...patch});expect(response.status,await response.clone().text()).toBe(200);};
    await configure();
    expect((await (await f.call(path)).json()) as any).toMatchObject({rule,timezone:'America/New_York'});
    const issue=await f.create({title:'synthetic-vector-193',priority:'urgent',assigneeOperatorId:f.bob});
    const excluded=await f.create({priority:'low'});
    const tick=async(at:string)=>{vi.setSystemTime(new Date(at));await scheduled({scheduledTime:Date.now()},bindings);};
    const notices=async(cookie=f.bobCookie)=>((await (await f.any(cookie,'/notifications?limit=50')).json()) as any).items.filter((n:any)=>n.identifier===issue.identifier&&n.causes.includes('sla_warning'));
    const occurrences=()=>env.DB.prepare('SELECT kind,count(*) n FROM issue_sla_occurrences WHERE issue_id=? GROUP BY kind ORDER BY kind').bind(issue.id).all();
    expect((await f.call('/settings/integrations/slack','POST',{botToken:edge.token})).status).toBe(200);
    const bind=async(provider='slack')=>{
      const response=await f.call('/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider,channelName:'SLA',events:['sla.warning'],...(provider==='slack'?{channelId:'CSLA'}:{webhookUrl:edge.webhook})});
      expect(response.status,await response.clone().text()).toBe(201);return (await response.json() as {id:string}).id;
    };
    let channel=await bind();
    await tick('2026-10-30T20:59:00Z');
    expect(await notices()).toHaveLength(0);
    expect(edge.calls.filter(c=>c.method==='chat.postMessage')).toHaveLength(0);
    await tick('2026-11-02T14:29:00Z'); // DST ended; Monday begins at 14:00 UTC.
    expect(await notices()).toHaveLength(0);
    expect((await (await f.call('/issues/'+issue.identifier+'/sla')).json() as any).remainingMinutes).toBe(31);
    await Promise.all([tick('2026-11-02T14:30:00Z'),tick('2026-11-02T14:30:00Z')]);
    // A fresh app and scheduler share only durable storage.
    expect((await createServerApp().request(bindings.APP_ORIGIN+'/api/issues/'+issue.identifier+'/sla',{headers:{cookie:f.cookie,origin:bindings.APP_ORIGIN,host:new URL(bindings.APP_ORIGIN).host,'CF-Connecting-IP':'192.0.2.18'}},bindings)).status).toBe(200);
    await tick('2026-11-02T14:31:00Z');
    expect(await notices()).toHaveLength(1);
    expect(await notices(f.cookie)).toHaveLength(0); // Creator is the event actor.
    expect(edge.calls.filter(c=>c.method==='chat.postMessage')).toHaveLength(1);
    expect(edge.calls.find(c=>c.method==='chat.postMessage')!.body).toEqual({channel:'CSLA',text:`${issue.identifier} · Resolution SLA warning\n${bindings.APP_ORIGIN}/app/issues/${issue.identifier}`,unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false});
    await Promise.all([tick('2026-11-02T15:00:00Z'),tick('2026-11-02T15:00:00Z')]);
    await tick('2026-11-02T15:10:00Z');
    expect((await occurrences()).results).toEqual([{kind:'breach',n:1},{kind:'warning',n:1}]);
    expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE subject_id=? AND action='sla.breached'").bind(issue.id).first('n')).toBe(1);
    expect(await env.DB.prepare('SELECT 1 FROM issue_sla_clocks WHERE issue_id=?').bind(excluded.id).first()).toBeNull();
    // Resolution stops the clock; reopening cannot re-arm either occurrence.
    expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:1,statusId:team.statuses.find(s=>s.category==='completed')!.id})).status).toBe(200);
    await tick('2026-11-02T16:00:00Z');
    const stopped=await env.DB.prepare('SELECT * FROM issue_sla_clocks WHERE issue_id=?').bind(issue.id).first();
    expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:2,statusId:team.statuses.find(s=>s.category==='unstarted')!.id})).status).toBe(200);
    await tick('2026-11-02T16:10:00Z');
    expect(await env.DB.prepare('SELECT * FROM issue_sla_clocks WHERE issue_id=?').bind(issue.id).first()).toEqual(stopped);
    // The native current triage-responsible member also receives a warning;
    // the same person in both roles still gets one Inbox row.
    for(const id of [f.bob,f.cara])expect((await f.call(`/settings/teams/${team.id}/members/${id}`,'PUT',{role:'member'})).status).toBe(200);
    expect((await f.call(`/settings/teams/${team.id}/triage-rotation`,'PUT',{startsLocal:'2026-11-02T09:00',operatorIds:[f.cara,f.bob]})).status).toBe(200);
    await f.call('/settings/integrations/channels/'+channel,'DELETE');channel=await bind('discord');
    await configure({targetMinutes:10,warnBeforeMinutes:5});
    const second=await f.create({title:'synthetic-vector-194',priority:'urgent',assigneeOperatorId:f.bob});
    await tick('2026-11-02T16:15:00Z');
    for(const cookie of [f.bobCookie,f.caraCookie]){
      const page=await (await f.any(cookie,'/notifications?limit=50')).json() as any;
      expect(page.items.filter((n:any)=>n.identifier===second.identifier&&n.causes.includes('sla_warning'))).toHaveLength(1);
    }
    expect(edge.calls.filter(c=>c.method==='discord')).toHaveLength(1);
    expect(edge.calls.find(c=>c.method==='discord')!.body).toEqual({content:`${second.identifier} · Resolution SLA warning\n${bindings.APP_ORIGIN}/app/issues/${second.identifier}`,allowed_mentions:{parse:[]},flags:4});
    await tick('2026-11-02T16:20:00Z');await dispatchWebhooks(bindings);
    expect(edge.calls.filter(c=>c.method==='discord')).toHaveLength(1);
    // Existing issue and event-type mutes consume this occurrence permanently.
    const muted=await f.create({priority:'urgent',assigneeOperatorId:f.bob});
    expect((await f.any(f.bobCookie,'/issues/'+muted.identifier+'/subscription','PATCH',{muted:true})).status).toBe(200);
    expect((await f.any(f.caraCookie,'/settings/notifications','PATCH',{mutedKinds:['sla_warning']})).status).toBe(200);
    await tick('2026-11-02T16:25:00Z');
    await f.any(f.bobCookie,'/issues/'+muted.identifier+'/subscription','PATCH',{muted:false});
    await f.any(f.caraCookie,'/settings/notifications','PATCH',{mutedKinds:[]});
    await tick('2026-11-02T16:26:00Z');
    expect(await env.DB.prepare("SELECT count(*) n FROM notifications WHERE issue_id=? AND causes_json='[\"sla_warning\"]'").bind(muted.id).first('n')).toBe(0);
    await verifySlaAuthority(f,rule,path,{adminCookie,viewerCookie,guestCookie});
    // A late completion before the first tick cannot generate an early warning.
    const resolved=await f.create({priority:'urgent'});
    await tick('2026-11-02T16:27:00Z');
    expect((await f.call('/issues/'+resolved.identifier,'PATCH',{expectedVersion:1,statusId:team.statuses.find(s=>s.category==='completed')!.id})).status).toBe(200);
    await tick('2026-11-02T16:50:00Z');
    expect(await env.DB.prepare('SELECT count(*) n FROM issue_sla_occurrences WHERE issue_id=?').bind(resolved.id).first('n')).toBe(0);
    // The native archive includes snapshots and both receipts, with no credentials.
    const exported=await f.call('/portability/exports','POST');expect(exported.status).toBe(201);
    const job=(await exported.json() as {id:string}).id;
    let phase='building';while(phase==='building'){phase=(await (await f.call('/portability/exports/'+job+'/advance','POST',{maxParts:16})).json() as {phase:string}).phase;}
    const file=await f.call('/portability/exports/'+job+'/download');expect(file.status).toBe(200);
    const rows:any[]=[];for await(const row of readArchive(file.body!))rows.push(row);
    const archiveText=JSON.stringify(rows);
    for(const table of ['team_slas','issue_sla_clocks','issue_sla_occurrences'])expect(archiveText).toContain(table);
    expect(archiveText).toContain(issue.id);expect(archiveText).not.toContain(edge.token);
    // Effects held by restoration never progress or reconstruct old warnings.
    await env.DB.prepare("INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,'synthetic-vector-193',1) ON CONFLICT(id) DO UPDATE SET effects_held=1").run();
    const before=(await env.DB.prepare('SELECT * FROM issue_sla_occurrences ORDER BY event_id').all()).results;
    await tick('2026-11-02T16:55:00Z');
    expect((await env.DB.prepare('SELECT * FROM issue_sla_occurrences ORDER BY event_id').all()).results).toEqual(before);
    // Erasure removes clock state and shared channel custody cannot replay it.
    const current=await (await f.call('/issues/'+second.identifier)).json() as any;
    expect((await f.call('/issues/'+second.identifier,'DELETE',{expectedVersion:current.version,confirmed:true})).status).toBe(200);
    expect(await env.DB.prepare('SELECT count(*) n FROM issue_sla_occurrences WHERE issue_id=?').bind(second.id).first('n')).toBe(0);
  }finally{edge.restore();vi.useRealTimers();}
}
async function verifySlaAuthority(f:Awaited<ReturnType<typeof setupAdministration>>&{bobCookie:string},rule:unknown,path:string,roles:{adminCookie:string;viewerCookie:string;guestCookie:string}) {
  const team=f.initial.teams[0];
  const {adminCookie,viewerCookie,guestCookie}=roles;
  for(const setting of ['team_owners','all_members']) {
    expect((await f.call(`/settings/teams/${team.id}/permissions`,'PUT',{settings:setting,planning:'all_members'})).status).toBe(200);
    for(const [cookie,expected] of [[f.cookie,200],[adminCookie,200],[f.bobCookie,setting==='all_members'?200:403],[viewerCookie,403],[guestCookie,403]] as const){
      const before=(await env.DB.prepare('SELECT * FROM team_slas').all()).results;
      const result=await request('/api'+path,'PUT',rule,cookie);expect(result.status,await result.clone().text()).toBe(expected);
      if(expected!==200)expect((await env.DB.prepare('SELECT * FROM team_slas').all()).results).toEqual(before);
    }
  }
  expect((await request('/api'+path,'PUT',rule)).status).toBe(401);
}
