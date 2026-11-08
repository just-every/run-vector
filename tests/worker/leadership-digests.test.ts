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
  const tick=(date:string)=>scheduled({scheduledTime:Date.parse(date)},remote,{fetch:network});
  try {
    await read('/settings/integrations/slack','POST',{botToken:edge.token});
    for (const [id,user,send] of [[f.owner,'UDIGEST1',f.call],[member,'UDIGEST2',call]] as const) {
      const email=await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(id).first<string>('email');
      edge.users(email!,user,'synthetic-vector-4003');
      await json(await send('/settings/notifications/slack/link','POST',{slackUserId:user}));
      await json(await send('/settings/notifications/leadership-digest','PUT',{email:true,slack:true}));
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
    await json(await call('/subscriptions/'+subscription.id,'DELETE'));
    await tick('2027-03-22T13:00:00Z');expect(mail).toHaveLength(5);expect(posts()).toHaveLength(5);
    await tick('2027-03-22T14:00:00Z');expect(mail).toHaveLength(5);expect(posts()).toHaveLength(5);
    expect(await env.DB.prepare("SELECT count(*) n FROM leadership_digest_receipts WHERE status='accepted'").first<number>('n')).toBe(10);
  } finally { edge.restore(); }
});
