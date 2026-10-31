import {env} from 'cloudflare:workers';
import {expect,vi} from 'vitest';
import {invite,actor,request,signIn} from './base-auth-fixture';
import type {setupAdministration} from './administration-fixture';
export async function teamTriageResponsibility(f:Awaited<ReturnType<typeof setupAdministration>>,teamId:string) {
 const firstEmail=['synthetic-vector-2660','vector.test'].join('@'),secondEmail=['synthetic-vector-2661','vector.test'].join('@');
 const firstCookie=await invite(firstEmail,f.cookie),secondCookie=await invite(secondEmail,f.cookie);
 const first=await actor(firstCookie),second=await actor(secondCookie),path='/settings/teams/'+teamId;
 for(const id of [first,second])expect((await f.call(path+'/members/'+id,'PUT',{role:'member'})).status).toBe(200);
 const fixed={mode:'fixed',operatorIds:[first],startsOn:'2038-03-07'};
 await f.mutate(path,'PATCH',{triageResponsibility:fixed});
 const make=async(cookie=f.cookie)=>{
  const response=await request('/api/intake','POST',{teamId,title:'synthetic-vector-2662'},cookie);expect(response.status,await response.clone().text()).toBe(201);return await response.json() as any;
 };
 const fixedIssue=await make();
 const notices=async(id:string)=>await env.DB.prepare("SELECT recipient_id,causes_json FROM notifications WHERE issue_id=? ORDER BY id").bind(id).all();
 expect((await notices(fixedIssue.id)).results).toEqual([{recipient_id:first,causes_json:'["new_triage"]'}]);
 const self=await make(firstCookie);expect((await notices(self.id)).results).toEqual([]);
 const inbox=await request('/api/notifications','GET',undefined,firstCookie);expect(inbox.status).toBe(200);
 expect((await inbox.json() as any).items.some((item:any)=>item.identifier===fixedIssue.identifier && item.causes.includes('new_triage'))).toBe(true);
 // Calendar dates cross the spring DST transition; elapsed milliseconds are not rotation weeks.
 const oldTimezone=(await f.state()).workspace.timezone;
 await f.mutate('/settings','PATCH',{timezone:'America/New_York'});
 const mailFloor=await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) n FROM rer_mail_development_outbox').first<number>('n');
 vi.useFakeTimers({toFake:['Date']});
 try {
  vi.setSystemTime(new Date('2038-03-13T16:00:00Z'));
  let cookie=await signIn();
  const call=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,cookie);
  expect((await call(path,'PATCH',{triageResponsibility:{mode:'weekly',operatorIds:[first,second],startsOn:'2038-03-07'}})).status).toBe(200);
  const weekOne=await make(cookie);expect((await notices(weekOne.id)).results[0]?.recipient_id).toBe(first);
  vi.setSystemTime(new Date('2038-03-14T04:30:00Z'));cookie=await signIn();
  const beforeMidnight=await make(cookie);expect((await notices(beforeMidnight.id)).results[0]?.recipient_id).toBe(first);
  vi.setSystemTime(new Date('2038-03-14T06:00:00Z'));cookie=await signIn();
  const weekTwo=await make(cookie);expect((await notices(weekTwo.id)).results[0]?.recipient_id).toBe(second);
  const current=await (await call('/current')).json() as any;
  const handover=current.triageAssignments.find((item:any)=>item.teamId===teamId);
  expect(handover.responsibleId).toBe(second);expect(handover.pending).toEqual(expect.arrayContaining([weekOne.identifier,beforeMidnight.identifier,weekTwo.identifier]));
  expect((await call(path+'/members/'+second,'DELETE')).status).toBe(200);
  const withdrawn=await make(cookie);expect((await notices(withdrawn.id)).results).toEqual([]);
  expect((await (await call('/current')).json() as any).triageAssignments.find((item:any)=>item.teamId===teamId).responsibleId).toBeNull();
  vi.setSystemTime(new Date('2038-03-21T04:30:00Z'));cookie=await signIn();
  const afterDst=await make(cookie);expect((await notices(afterDst.id)).results[0]?.recipient_id).toBe(first);
  expect((await call(path,'PATCH',{triageResponsibility:fixed,triageEnabled:false})).status).toBe(200);
  const off=await make(cookie);expect(off.status.category).toBe('backlog');expect((await notices(off.id)).results).toEqual([]);
 } finally {vi.useRealTimers();await env.DB.prepare('DELETE FROM rer_mail_development_outbox WHERE sequence>?').bind(mailFloor!).run();}
 await f.mutate(path,'PATCH',{triageResponsibility:null,triageEnabled:true});
 await f.mutate('/settings','PATCH',{timezone:oldTimezone});
}
