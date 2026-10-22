import { expect } from 'vitest';
import {channelEdge} from './channel-edge-fixture';
import { createServerApp } from '../../src/core/app/server';
import { scheduled } from '../../src/core/app/scheduled';
import { createWebhookProtocol } from '../../vendor/base/integrations';
import { auditSchema, auditSearch } from '../../src/core/features/audit/schema';
import { bindings } from './base-auth-fixture';
import { resetLimits, type roleWorkspace } from './role-fixture';

type Workspace = Awaited<ReturnType<typeof roleWorkspace>>;
async function json<T>(response: Promise<Response>, status = 200) {
  const settled = await response;
  expect(settled.status, await settled.clone().text()).toBe(status);
  return settled.json() as Promise<T>;
}
/** Continues the existing role/administration journey; all audit entries come
 * from public mutations, native sign-ins or the deployed Cron entry. */
export async function exerciseAudit(w: Workspace) {
  await resetLimits();
  const { owner, admin, member, guest } = w.people;
  await json(owner.call('/settings/operators/'+member.id+'/role','PATCH',{role:'admin'}));
  await json(owner.call('/settings/operators/'+member.id+'/role','PATCH',{role:'member'}));
  const importedRows=Buffer.from(JSON.stringify([{id:'synthetic-vector-1',title:'Audit import',team:w.team.name,status:w.team.statuses.find(s=>s.category==='backlog')!.name,created:'2026-09-01T01:02:03.000Z',updated:'2026-09-02T04:05:06.000Z'}])).toString('base64');
  const input={format:'json',source:'audit-import',name:'issues.json',base64:importedRows,mapping:{sourceId:'id',title:'title',team:'team',status:'status',createdAt:'created',updatedAt:'updated'}};
  const preview=await json<{fingerprint:string;effectiveAt:string}>(owner.call('/data/import/preview','POST',input));
  await json(owner.call('/data/import/apply','POST',{input:{...input,effectiveAt:preview.effectiveAt},reviewedFingerprint:preview.fingerprint,operationKey:'audit:'+preview.fingerprint,acknowledgeOmissions:true}));
  const exported=await json<{id:string}>(owner.call('/portability/exports','POST',{}),201);
  while((await json<{phase:string}>(owner.call('/portability/exports/'+exported.id+'/advance','POST',{maxParts:16}))).phase==='building');
  const view=await json<{id:string}>(owner.call('/views','POST',{name:'Audited view',layout:'list',query:{team:w.team.id}}),201);
  await json(owner.call('/views/'+view.id,'DELETE'));
  const projects=await json<{projects:{id:string;name:string}[]}>(owner.call('/settings/projects','POST',{name:'Audited milestones',leadOperatorId:owner.id}));
  const project=projects.projects.find(p=>p.name==='Audited milestones')!;
  const detail=await json<{milestones:{id:string}[]}>(owner.call('/settings/projects/'+project.id+'/milestones','POST',{name:'Audited milestone'}));
  await json(owner.call('/settings/projects/'+project.id+'/milestones/'+detail.milestones[0].id,'DELETE'));
  await json(owner.call('/settings/projects/'+project.id,'DELETE'));
  const edge=channelEdge();
  try {
    await json(owner.call('/settings/integrations/slack','POST',{botToken:edge.token}));
    await json(owner.call('/settings/integrations/slack/signing-secret','POST',{signingSecret:'synthetic-vector-80000001'.replaceAll('-', '')}));
    await json(owner.call('/settings/integrations/channels/allowed','POST',{channelId:'CAUDIT',channelName:'audited-delivery'}),201);
    const channelProjectState=await json<{projects:{id:string;name:string}[]}>(owner.call('/settings/projects','POST',{name:'Audit channel project',leadOperatorId:owner.id}));
    const channelProject=channelProjectState.projects.find(p=>p.name==='Audit channel project')!;
    const bound=await json<{id:string}>(member.call('/projects/'+channelProject.id+'/slack-channel','POST',{channelId:'CAUDIT'}),201);
    await json(owner.call('/settings/integrations/channels/'+bound.id,'DELETE'));
    await json(owner.call('/settings/integrations/channels/allowed/CAUDIT','DELETE'));
    await json(owner.call('/settings/integrations/slack','DELETE'));
  } finally { edge.restore(); }
  const source = await json<{id:string;workspaceId:string;sourceId:string;secret:string;receiver:string}>(owner.call('/settings/integrations/sources', 'POST', { name:'Audit source', sourceId:'audit-source', teamId:w.team.id }),201);
  const protocol = createWebhookProtocol({resolveDestination:async()=>source.receiver,signingKey:async()=>new Uint8Array(source.secret.match(/../g)!.map(pair=>parseInt(pair,16)))});
  const body=JSON.stringify({title:'Audited signed intake',teamId:w.team.id,sourceRecordId:'synthetic-vector-1',sourceRevisionId:'synthetic-vector-1',observedAt:new Date().toISOString()});
  const wire=await protocol.prepare({id:crypto.randomUUID(),tenant:source.workspaceId,destinationId:source.sourceId,event:'signal.revision',protocol:'webhook',body},Date.now());
  const received=await createServerApp().request(source.receiver,{method:'POST',headers:wire.headers,body},bindings);
  expect(received.status,await received.clone().text()).toBe(200);
  await json(owner.call(`/settings/integrations/sources/${source.id}/webhook-url`,'POST',{}),201);
  await json(owner.call(`/settings/integrations/sources/${source.id}/rotate`,'POST',{overlapHours:0}));
  await json(owner.call(`/settings/integrations/sources/${source.id}`,'DELETE'));
  const issued=await json<{credential:{id:string}}>(owner.call('/settings/integrations/tokens','POST',{name:'Audit token',scopes:['issues:read']}),201);
  await json(owner.call('/settings/integrations/tokens/'+issued.credential.id,'DELETE'));
  const work=await json<{id:string;identifier:string;version:number}>(owner.call('/issues','POST',{title:'Retained deletion reference',teamId:w.team.id}),201);
  await json(owner.call(`/issues/${work.identifier}`,'DELETE',{expectedVersion:work.version,confirmed:true}));
  expect((await owner.call(`/issues/${work.identifier}`)).status).toBe(404);
  await json(owner.call('/data/erasure','POST',{subject:{names:['Departed Author']},confirmation:'erase Departed Author'}));
  await json(owner.call(`/settings/teams/${w.team.id}/cycle-schedule`,'PUT',{weeks:2,startWeekday:1,cooldownWeeks:0,upcomingCount:1}));
  await scheduled({scheduledTime:Date.now()},bindings);
  // An erased live-person link must retain the opaque original actor.
  const departing=await w.fresh('admin',false);
  const labelState=await json<{labels:{id:string;name:string}[]}>(departing.call('/settings/labels','POST',{name:'Audited author label',color:'#123456'}));
  const label=labelState.labels.find(item=>item.name==='Audited author label')!;
  await json(owner.call('/settings/operators/'+departing.id,'DELETE'));
  await resetLimits();
  const all=auditSchema.parse(await json(owner.call('/settings/audit')));
  const actions=new Set(all.entries.map(e=>e.action));
  for(const action of ['auth.signed_in','operator.invited','operator.joined','operator.role_changed','team.member_added','token.issued','token.revoked',
    'integration.source_registered','integration.source_rotated','integration.source_webhook_rotated','integration.source_revoked','integration.source_received',
    'slack.connected','slack.disconnected','slack.signing_secret_changed','slack.channel_allowed','slack.channel_disallowed','channel.bound','channel.unbound',
    'view.deleted','project.milestone_removed','project.removed','import.started','archive.export.started','person.erased','cycle.created.automation','issue.deleted','operator.removed']) expect(actions.has(action),action).toBe(true);
  const deleted=all.entries.find(e=>e.action==='issue.deleted'&&e.subjectRef===work.id)!;
  expect(deleted).toMatchObject({actorRef:'person:'+owner.id,actorKind:'person',subjectRef:work.id});
  const departed=all.entries.find(e=>e.action==='label.created'&&e.subjectRef===label.id)!;
  expect(departed).toMatchObject({actorName:null,actorRef:'person:'+departing.id,actorKind:'person'});
  expect(all.entries.some(e=>e.actorKind==='integration'&&e.actorRef==='integration:'+source.id)).toBe(true);
  expect(all.entries.some(e=>e.actorKind==='automation')).toBe(true);
  const filters={actor:deleted.actorRef,kind:deleted.actorKind,action:deleted.action,subject:deleted.subjectRef,from:deleted.at,to:deleted.at};
  const selected=auditSchema.parse(await json(admin.call('/settings/audit?'+auditSearch(filters))));
  expect(selected.entries).toEqual([deleted]);
  // An event after the view snapshot cannot silently appear in its CSV.
  await json(owner.call('/settings/labels','POST',{name:'New after snapshot',color:'#345678'}));
  const csv=await owner.call('/settings/audit.csv?through='+all.through);
  expect(csv.status).toBe(200);
  const text=await csv.text();
  const ids=text.trim().split('\r\n').slice(1).map(line=>line.split(',')[0].slice(1,-1));
  expect(ids).toEqual(all.entries.map(e=>e.id));
  for(const path of ['/settings/audit?'+auditSearch(filters),'/settings/audit.csv?'+auditSearch(filters)]) {
    const response=await admin.call(path); expect(response.status).toBe(200);
    if(path.includes('.csv')) { const rows=(await response.text()).trim().split('\r\n');expect(rows).toHaveLength(2);expect(rows[1]).toContain('"'+work.id+'"'); }
  }
  expect(auditSchema.parse(await json(owner.call('/settings/audit'))).entries.some(entry=>entry.action==='audit.exported'&&entry.actorRef==='person:'+owner.id)).toBe(true);
  for(const who of [member,guest]) for(const path of ['/settings/audit','/settings/audit.csv']) expect((await who.call(path)).status).toBe(403);
  for(const method of ['PATCH','DELETE']) expect((await owner.call('/settings/audit',method,{})).status).toBe(404);
  expect((await owner.call('/settings/audit?from=invalid')).status).toBe(400);
  expect((await owner.call('/settings/audit?from=2030-01-02T00:00:00Z&to=2030-01-01T00:00:00Z')).status).toBe(400);
  expect((auditSchema.parse(await json(owner.call('/settings/audit?subject=absent')))).entries).toEqual([]);
}
