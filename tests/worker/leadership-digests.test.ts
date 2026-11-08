import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { setupAdministration } from './administration-fixture';
import { actor, bindings, invite, request } from './base-auth-fixture';
import { channelEdge } from './channel-edge-fixture';
import { scheduled } from '../../src/core/app/scheduled';

const json = async (value: Response|Promise<Response>, status=200) => {
  const response=await value;
  expect(response.status,await response.clone().text()).toBe(status); return response.json() as Promise<any>;
};
const remote = {...bindings,APP_ORIGIN:'https://vector.example.test',MAIL_MODE:'production',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-vector-4001'};
it('weekly leadership scheduled delivery deduplicates owners and subscribers in both channels and projects current private access and exact changes',async()=>{
  const f=await setupAdministration(), edge=channelEdge('TFIXTURE');
  const mail: any[]=[];
  const network: typeof fetch=async(_input,init)=>{mail.push(JSON.parse(String(init?.body)));return new Response(null,{status:202});};
  const cookie=await invite(['synthetic-vector-4002','vector.test'].join('@'),f.cookie), member=await actor(cookie);
  const call=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,cookie);
  const read=(path:string,method='GET',body?:unknown)=>json(f.call(path,method,body));
  const tick=(date:string,beforeAdmission?:any)=>scheduled({scheduledTime:Date.parse(date)},remote,{fetch:network,beforeAdmission});
  try {
    await read('/settings/integrations/slack','POST',{botToken:edge.token});
    for (const [id,user,send] of [[f.owner,'UDIGEST1',f.call],[member,'UDIGEST2',call]] as const) {
      const email=await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(id).first<string>('email');
      edge.users(email!,user,'synthetic-vector-4003');
      await json(await send('/settings/notifications/slack/link','POST',{slackUserId:user}));
      await json(await send('/settings/notifications/leadership-digest','PUT',{email:true,slack:true}));
      expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE action='leadership_digest.channels_changed' AND actor_operator_id=?").bind(id).first<number>('n')).toBe(1);
      await json(await send('/settings/personal-time','PATCH',{timezone:'America/New_York',workingHoursStart:'09:00',workingHoursEnd:'17:00',workingDays:[1,2,3,4,5]}));
    }
    let root=await json(await f.call('/initiatives','POST',{name:'synthetic-vector-4004',ownerOperatorId:f.owner,targetDate:'2027-04-01',description:'NEVER_SEND_INITIATIVE_BODY'}),201);
    await json(await f.call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
    const subscription=await json(await call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
    const privateTeam=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-4005',identifierPrefix:'PRVDIG',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-4005')!;
    const projects=[];
    for (let i=0;i<2;i++) {
      const name='synthetic-vector-400'+(6+i);
      const project=(await f.mutate('/settings/projects','POST',{name,leadOperatorId:f.owner,targetDate:'2027-04-01',description:'NEVER_SEND_PROJECT_BODY'})).projects.find(p=>p.name===name)!;
      await read('/settings/projects/'+project.id,'PATCH',{lifecycle:'active'});
      projects.push(project);
      await f.create({teamId:i===0?f.initial.teams[0].id:privateTeam.id,projectId:project.id,title:'NEVER_SEND_ISSUE_TITLE',description:'NEVER_SEND_ISSUE_BODY'});
    }
    root=await read('/initiatives/'+root.id+'/projects','PUT',{expectedVersion:root.version,projectIds:projects.map(p=>p.id)});
    const milestone=(await read('/settings/projects/'+projects[0].id+'/milestones','POST',{name:'synthetic-vector-4008',description:'NEVER_SEND_MILESTONE_BODY'})).milestones[0];
    const posts=()=>edge.calls.filter(c=>c.method==='chat.postMessage');
    await tick('2027-03-08T13:59:00Z');expect(mail).toHaveLength(0);expect(posts()).toHaveLength(0);
    await Promise.all([tick('2027-03-08T14:00:00Z'),tick('2027-03-08T14:00:00Z')]);
    await tick('2027-03-08T15:00:00Z');
    expect(mail).toHaveLength(2);expect(posts()).toHaveLength(2);
    const personMail=(id:string)=>mail.find(m=>m.personalizations[0].to[0].email===id).content[0].value as string;
    const email=await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(member).first<string>('email');
    const memberText=personMail(email!);
    expect(memberText).toContain('synthetic-vector-4004 — planned');expect(memberText).toContain('synthetic-vector-4006 — active · Health: on-track');
    for(const hidden of [projects[1].id,projects[1].name,privateTeam.id,'NEVER_SEND'])expect(memberText).not.toContain(hidden);
    expect(posts().find(c=>c.body.channel==='DDIGEST2')!.body.text).not.toContain(projects[1].name);
    expect(posts().find(c=>c.body.channel==='DDIGEST1')!.body.text).toContain(projects[1].name);
    for(const entry of mail)expect(entry.content[0].value).not.toContain('NEVER_SEND');
    await read('/settings/teams/'+privateTeam.id+'/members/'+member,'PUT',{role:'member'});
    root=await read('/initiatives/'+root.id,'PATCH',{expectedVersion:root.version,targetDate:'2027-04-09'});
    await read('/settings/projects/'+projects[0].id,'PATCH',{targetDate:'2027-04-08'});
    await f.create({projectId:projects[0].id,title:'NEVER_SEND_URGENT_TITLE',priority:'urgent',assigneeOperatorId:null});
    await read('/settings/projects/'+projects[0].id+'/milestones/'+milestone.id,'PATCH',{completed:true});
    await tick('2027-03-15T13:00:00Z'); // first working hour after DST changes
    expect(mail).toHaveLength(4);expect(posts()).toHaveLength(4);
    const changed=mail.slice(2).find(m=>m.personalizations[0].to[0].email===email).content[0].value as string;
    expect(changed).toContain(projects[1].name);
    expect(changed).toContain('Target slipped: 2027-04-01 → 2027-04-09');
    expect(changed).toContain('Target slipped: 2027-04-01 → 2027-04-08');
    expect(changed).toContain('New risk: Urgent work is unassigned:');
    expect(changed).toContain('Milestone completed: synthetic-vector-4008');
    expect(changed).toContain(remote.APP_ORIGIN+'/app/initiatives/'+root.id);
    expect(changed).toContain(remote.APP_ORIGIN+'/app/projects/'+projects[0].id+'#milestone-'+milestone.id);
    let membershipWithdrawn=false;
    await tick('2027-03-22T13:00:00Z',async(receipt:any)=>{
      if(receipt.recipient_id===member&&!membershipWithdrawn){membershipWithdrawn=true;await read('/settings/teams/'+privateTeam.id+'/members/'+member,'DELETE');}
    });
    expect(mail).toHaveLength(6);expect(posts()).toHaveLength(6);
    const withdrawn=mail.slice(4).find(m=>m.personalizations[0].to[0].email===email).content[0].value as string;
    expect(withdrawn).not.toContain(projects[1].id);expect(withdrawn).not.toContain(projects[1].name);
    expect(withdrawn).not.toContain('Target slipped:');expect(withdrawn).not.toContain('New risk:');expect(withdrawn).not.toContain('Milestone completed:');
    expect(posts().filter(c=>c.body.channel==='DDIGEST2').at(-1)!.body.text).not.toContain(projects[1].name);
    await json(await call('/subscriptions/'+subscription.id,'DELETE'));
    await tick('2027-03-29T13:00:00Z');expect(mail).toHaveLength(7);expect(posts()).toHaveLength(7);
    await tick('2027-03-29T14:00:00Z');expect(mail).toHaveLength(7);expect(posts()).toHaveLength(7);
    expect(await env.DB.prepare("SELECT count(*) n FROM leadership_digest_receipts WHERE status='accepted'").first<number>('n')).toBe(14);
    await read('/settings/personal-time','PATCH',{timezone:'America/New_York',workingHoursStart:'01:00',workingHoursEnd:'03:00',workingDays:[7]});
    await tick('2027-11-07T05:30:00Z');await tick('2027-11-07T06:30:00Z');
    expect(mail).toHaveLength(8);expect(posts()).toHaveLength(8); // repeated local DST hour occupies one week slot

  } finally { edge.restore(); }
});

it('weekly leadership delivery revalidates withdrawal, unlinking, disabled installs, holds and erasure and retries only definite rejection',async()=>{
  const f=await setupAdministration(),edge=channelEdge('TFIXTURE');
  const cookie=await invite(['synthetic-vector-4010','vector.test'].join('@'),f.cookie),member=await actor(cookie);
  const call=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,cookie);
  const mine=(path:string,method='GET',body?:unknown)=>json(call(path,method,body));
  const owner=(path:string,method='GET',body?:unknown)=>json(f.call(path,method,body));
  let mailCount=0,mailStatus=202;
  const network:typeof fetch=async()=>{mailCount++;return new Response(null,{status:mailStatus});};
  const tick=(at:string,beforeAdmission?:any,afterSubmission?:()=>Promise<void>)=>scheduled({scheduledTime:Date.parse(at)},remote,{fetch:network,beforeAdmission,afterSubmission});
  const posts=()=>edge.calls.filter(c=>c.method==='chat.postMessage');
  try {
    await owner('/settings/integrations/slack','POST',{botToken:edge.token});
    const email=await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(member).first<string>('email');
    edge.users(email!,'UDIGEST3','synthetic-vector-4011');
    await mine('/settings/notifications/slack/link','POST',{slackUserId:'UDIGEST3'});
    await mine('/settings/notifications/leadership-digest','PUT',{email:true,slack:true});
    await mine('/settings/personal-time','PATCH',{timezone:'UTC',workingHoursStart:'09:00',workingHoursEnd:'17:00',workingDays:[1,2,3,4,5]});
    const root=await json(f.call('/initiatives','POST',{name:'synthetic-vector-4012',ownerOperatorId:f.owner}),201);
    let sub=await json(call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
    // A claimed intent must not survive withdrawal before either transport.
    let withdrew=false;
    await tick('2027-01-04T09:00:00Z',async()=>{if(!withdrew){withdrew=true;await mine('/subscriptions/'+sub.id,'DELETE');}});
    expect(mailCount).toBe(0);expect(posts()).toHaveLength(0);
    sub=await json(call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
    mailStatus=429;
    await tick('2027-01-11T09:00:00Z');expect(mailCount).toBe(1);expect(posts()).toHaveLength(1);
    mailStatus=202;
    await tick('2027-01-11T09:00:59Z');expect(mailCount).toBe(1);
    await tick('2027-01-11T09:01:00Z');expect(mailCount).toBe(2);expect(posts()).toHaveLength(1);
    await tick('2027-01-11T10:00:00Z');expect(mailCount).toBe(2);expect(posts()).toHaveLength(1);
    // Slack's definitive rate limit uses the existing durable delivery's retry claim.
    edge.postMode('retry');await tick('2027-01-18T09:00:00Z');expect(posts()).toHaveLength(2);
    edge.postMode('accepted');await tick('2027-01-18T09:01:00Z');expect(posts()).toHaveLength(3);
    await tick('2027-01-18T10:00:00Z');expect(posts()).toHaveLength(3);
    const beforeUnlink=posts().length;
    await tick('2027-01-25T09:00:00Z',async(receipt:any)=>{if(receipt.channel==='slack')await mine('/settings/notifications/slack/link','DELETE');});
    expect(posts()).toHaveLength(beforeUnlink);
    await mine('/settings/notifications/slack/link','POST',{slackUserId:'UDIGEST3'});
    // A network-edge change after conversations.open is observed before chat.postMessage.
    let stopped=false;
    edge.beforeCall(async(method)=>{if(method==='conversations.open'&&!stopped){stopped=true;await mine('/subscriptions/'+sub.id,'DELETE');}});
    await tick('2027-02-01T09:00:00Z');expect(posts()).toHaveLength(beforeUnlink);edge.beforeCall();
    sub=await json(call('/subscriptions','POST',{subjectType:'initiative',subjectId:root.id}),201);
    await owner('/settings/integrations/slack','DELETE');
    mailStatus=429;
    await tick('2027-02-08T09:00:00Z');expect(posts()).toHaveLength(beforeUnlink);
    await tick('2027-02-08T09:01:00Z');await tick('2027-02-08T09:06:00Z');
    expect(await env.DB.prepare("SELECT status,attempts FROM leadership_digest_receipts WHERE recipient_id=? AND slot='2027-02-08' AND channel='email'").bind(member).first()).toEqual({status:'failed',attempts:3});
    const exhausted=mailCount;await tick('2027-02-08T10:00:00Z');expect(mailCount).toBe(exhausted);
    mailStatus=202;
    // Expired claims and lost acknowledgements are terminal, even after restart.
    const beforeCrash=mailCount;
    await expect(tick('2027-02-15T09:00:00Z',undefined,async()=>{throw Error('synthetic-vector-settlement-crash');})).rejects.toThrow('synthetic-vector-settlement-crash');
    await tick('2027-02-15T10:00:00Z');expect(mailCount).toBe(beforeCrash+1);
    expect(await env.DB.prepare("SELECT status FROM leadership_digest_receipts WHERE recipient_id=? AND slot='2027-02-15' AND channel='email'").bind(member).first<string>('status')).toBe('uncertain');
    // Restore fences stop later weeks, not merely the already consumed receipt.
    await env.DB.prepare("INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,'synthetic-vector-4013',1)").run();
    const held=mailCount;await tick('2027-02-22T09:00:00Z');expect(mailCount).toBe(held);
    await env.DB.prepare('DELETE FROM vector_restore_status').run();
    // An unlinked or inactive person never regains a pending send after erasure.
    await tick('2027-03-01T09:00:00Z',async()=>{await owner('/settings/operators/'+member,'DELETE');});
    expect(mailCount).toBe(held);
    expect(await env.DB.prepare('SELECT count(*) n FROM leadership_digest_receipts WHERE recipient_id=?').bind(member).first<number>('n')).toBe(0);
    expect(await env.DB.prepare('SELECT count(*) n FROM leadership_digest_preferences WHERE operator_id=?').bind(member).first<number>('n')).toBe(0);
    await tick('2027-03-08T09:00:00Z');expect(mailCount).toBe(held);
  } finally {edge.restore();}
});
