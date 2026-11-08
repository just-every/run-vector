import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { roleWorkspace } from './role-fixture';
import type { channelEdge } from './channel-edge-fixture';
import { json, refused } from './custom-fields-journey';
import { bindings } from './base-auth-fixture';
import { evaluateRules } from '../../src/core/features/automation-rules/evaluation';
import { reconcileRuleDeliveries } from '../../src/core/features/automation-rules/failures';
import { dispatchWebhooks, outboundService } from '../../src/core/features/integrations/outbound';
type Workspace=Awaited<ReturnType<typeof roleWorkspace>>;
/** Real native doors around the dangerous paths: budget races, provider failure,
 * channel safety, private content, current owner authority and durable retries. */
export async function automationSafety(w:Workspace,edge:ReturnType<typeof channelEdge>) {
  const {owner,admin}=w.people,api='/settings/automation-rules';
  const posts=()=>edge.calls.filter(c=>c.method==='chat.postMessage');
  const tick=async()=>{await evaluateRules(bindings,new Date('2030-05-17T10:00:00Z'));await dispatchWebhooks(bindings);await reconcileRuleDeliveries(bindings,new Date('2030-05-17T10:00:00Z'));};
  const labelState=await json(owner.call('/settings/labels','POST',{name:'synthetic-vector-rule-safety',color:'#993344'}));
  const label=labelState.labels.find((l:any)=>l.name==='synthetic-vector-rule-safety').id;
  const createTeam=async(name:string,isPrivate=false)=>(await json(owner.call('/settings/teams','POST',{name,identifierPrefix:name,isPrivate}))).teams.find((t:any)=>t.name===name);
  const team=await createTeam('RULESAFE'),hidden=await createTeam('RULEHID',true);
  const binding=async(teamId:string,channelId:string)=>json(owner.call('/settings/integrations/channels','POST',{scope:'team',objectId:teamId,provider:'slack',channelId,channelName:'security',events:['automation.rule']}),201);
  const publicBinding=await binding(team.id,'CRULESAFE');
  const input={name:'synthetic-vector-rule-safety',labelId:label,priority:'urgent',destinationId:publicBinding.id,monthlyBudget:1,enabled:true};
  let rule=await json(owner.call(api,'POST',{...input,expectedVersion:0}),201);
  const issue=async(teamId=team.id)=>json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-private-rule-title',description:'synthetic-vector-private-rule-body',priority:'low',labelIds:[label]}),201);
  const pair=await Promise.all([issue(),issue()]),mark=posts().length;
  await Promise.all([evaluateRules(bindings,new Date('2030-05-17T10:00:00Z')),evaluateRules(bindings,new Date('2030-05-17T10:00:00Z'))]); await tick();
  const log=await json(owner.call(api+'/'+rule.id+'/runs'));
  expect(log.runs.map((r:any)=>r.state).sort()).toEqual(['budget_exhausted','succeeded']);
  expect(posts()).toHaveLength(mark+1);
  expect((await Promise.all(pair.map(i=>json(owner.call('/issues/'+i.identifier))))).map(i=>i.priority).sort()).toEqual(['low','urgent']);
  // No user can inject the evaluator's attribution or a label-mutating action.
  await refused(()=>owner.call(api,'POST',{...input,expectedVersion:0,action:{labelIds:[label]}}),400,'unsupported action cannot introduce a loop');
  await refused(()=>owner.call('/issues/'+pair[0].identifier,'PATCH',{expectedVersion:pair[0].version,priority:'high',automationRuleId:rule.id}),400,'caller cannot forge automation provenance');
  // Private-team messages are generic even for a workspace Owner's rule; a
  // non-member Admin cannot read either issue data or its populated run log.
  const privateBinding=await binding(hidden.id,'CRULEPRIVATE');
  await json(owner.call(api+'/'+rule.id,'PATCH',{...input,monthlyBudget:50,destinationId:privateBinding.id,expectedVersion:rule.version}));
  rule={...rule,version:rule.version+1};
  const privateIssue=await issue(hidden.id),privateBefore=posts().length;
  await tick();
  expect(posts()).toHaveLength(privateBefore+1);
  expect(posts().at(-1)!.body.text).toBe('Private work changed. Sign in to Vector to view it.');
  const adminLog=await json(admin.call(api+'/'+rule.id+'/runs'));
  expect(JSON.stringify(adminLog)).not.toContain(privateIssue.identifier);
  expect(JSON.stringify(adminLog)).not.toContain(privateIssue.id);
  // Revocation after a committed change prevents the queued send. It records a
  // failure rather than pretending the priority change never happened.
  await json(owner.call(api+'/'+rule.id,'PATCH',{...input,monthlyBudget:50,expectedVersion:rule.version})); rule.version++;
  const revoked=await issue(),revokedBefore=posts().length;
  await evaluateRules(bindings,new Date('2030-05-17T10:00:00Z'));
  expect((await json(owner.call('/issues/'+revoked.identifier))).priority).toBe('urgent');
  await json(owner.call('/settings/integrations/channels/'+publicBinding.id,'DELETE'));
  await dispatchWebhooks(bindings); await reconcileRuleDeliveries(bindings,new Date('2030-05-17T10:00:00Z'));
  expect(posts()).toHaveLength(revokedBefore);
  let state=(await json(owner.call(api))).rules.find((r:any)=>r.id===rule.id);
  expect(state.failure).toBe('destination_unavailable');
  const notices=async()=>(await env.DB.prepare("SELECT id FROM notifications WHERE event_id=?").bind('rule-failure:'+rule.id+':'+rule.version).all()).results;
  expect(await notices()).toHaveLength(1);
  for(let n=0;n<3;n++)await tick(); expect(await notices()).toHaveLength(1);
  const inbox=await json(owner.call('/notifications?limit=50'));
  expect(JSON.stringify(inbox)).toContain('Automation rule failed: synthetic-vector-rule-safety');
  const notice=inbox.items.find((row:any)=>row.actor==='Automation rule failed: synthetic-vector-rule-safety');
  await json(owner.call('/notifications/'+notice.id+'/read','POST',{}));
  // Repair is an explicit versioned save. Dispatch rechecks current Slack flags.
  const repairedBinding=await binding(team.id,'CRULEREPAIRED');
  await json(owner.call(api+'/'+rule.id,'PATCH',{...input,monthlyBudget:50,destinationId:repairedBinding.id,expectedVersion:rule.version})); rule.version++;
  await issue(); await evaluateRules(bindings,new Date('2030-05-17T10:00:00Z')); const unsafeBefore=posts().length;
  edge.safety({is_shared:true}); await dispatchWebhooks(bindings); await reconcileRuleDeliveries(bindings,new Date('2030-05-17T10:00:00Z')); edge.safety();
  expect(posts()).toHaveLength(unsafeBefore);
  state=(await json(owner.call(api))).rules.find((r:any)=>r.id===rule.id); expect(state.failure).toBe('destination_unavailable');
  // Provider acknowledgement loss is terminal uncertainty, never an automatic
  // duplicate send. The owner is told once and existing changes remain visible.
  const uncertainBinding=await binding(team.id,'CRULEUNKNOWN');
  await json(owner.call(api+'/'+rule.id,'PATCH',{...input,monthlyBudget:50,destinationId:uncertainBinding.id,expectedVersion:rule.version})); rule.version++;
  const uncertain=await issue(); edge.postMode('uncertain'); const attempts=posts().length;
  await tick(); edge.postMode('accepted'); await tick();
  expect(posts()).toHaveLength(attempts+1);
  state=(await json(owner.call(api))).rules.find((r:any)=>r.id===rule.id); expect(state.failure).toBe('delivery_uncertain');
  expect((await json(owner.call('/issues/'+uncertain.identifier))).priority).toBe('urgent');
  expect((await env.DB.prepare("SELECT id FROM notifications WHERE event_id=?").bind('rule-failure:'+rule.id+':'+rule.version).all()).results).toHaveLength(1);
  // A demoted owner confers no retained authority to a workspace rule.
  const delegated=await w.fresh('admin'),freshBinding=await binding(team.id,'CRULEAUTH');
  const owned=await json(delegated.call(api,'POST',{...input,monthlyBudget:50,destinationId:freshBinding.id,expectedVersion:0}),201);
  const pending=await issue();
  await json(owner.call('/settings/operators/'+delegated.id+'/role','PATCH',{role:'member'}));
  const beforeDemotion=posts().length; await tick();
  expect((await json(owner.call('/issues/'+pending.identifier))).priority).toBe('low'); expect(posts()).toHaveLength(beforeDemotion);
  expect((await json(owner.call(api+'/'+owned.id+'/runs'))).runs.find((r:any)=>r.issue_id===pending.id)).toMatchObject({state:'stopped',reason:'rule_or_access_changed'});
}
