import {scheduled} from '../../src/core/app/scheduled';
import {automationSafety} from './automation-rule-safety';
import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { roleWorkspace, resetLimits, snapshot } from './role-fixture';
import { json, refused } from './custom-fields-journey';
import { channelEdge } from './channel-edge-fixture';
import { bindings } from './base-auth-fixture';
import { evaluateRules } from '../../src/core/features/automation-rules/evaluation';
import { dispatchWebhooks } from '../../src/core/features/integrations/outbound';
import { createServerApp } from '../../src/core/app/server';
import { automationWriters } from './automation-rule-writers';
import { automationArchive } from './automation-rule-archive';

it('[AUTO-002 ROLE-008 ROLE-009] label rules dry-run without effects and commit one accountable priority change and Slack notice with bounded, replay-safe, current authority', async () => {
  const w = await roleWorkspace(), {owner,admin,lead,member,guest} = w.people, team = w.team.id, edge = channelEdge();
  const api = '/settings/automation-rules', teamApi = `/settings/teams/${team}/automation-rules`;
  const tables = ['automation_rules','automation_rule_runs','automation_rule_usage','issues','issue_activity','audit_records','notifications','vector_webhook_events','integration_deliveries'];
  const posts = () => edge.calls.filter(call => call.method === 'chat.postMessage');
  const tick = async () => { await evaluateRules(bindings,new Date('2030-05-17T10:00:00Z')); await dispatchWebhooks(bindings); };
  try {
    await json(owner.call('/settings/integrations/slack','POST',{botToken:edge.token}));
    const destination = await json(owner.call('/settings/integrations/channels','POST',{scope:'team',objectId:team,provider:'slack',channelId:'CSECURITY',channelName:'security',events:['automation.rule']}),201);
    const labels = await json(owner.call('/settings/labels','POST',{name:'Security',color:'#992222'}));
    const label = labels.labels.find((row:any) => row.name === 'Security').id;
    const input = {name:'Security escalation',labelId:label,priority:'urgent',destinationId:destination.id,monthlyBudget:100,enabled:true};
    const draftIssue = await json(owner.call('/issues','POST',{teamId:team,title:'synthetic-vector-9400',priority:'low',labelIds:[label]}),201);
    const beforeDry = await snapshot(tables), beforeNetwork = edge.calls.length;
    const dry = await json(owner.call(api+'/dry-run','POST',input));
    expect(dry).toMatchObject({writes:0,notifications:0,matches:[{identifier:draftIssue.identifier,changes:[{field:'priority',from:'low',to:'urgent'}],notification:{destinationId:destination.id}}]});
    expect(await snapshot(tables)).toEqual(beforeDry);
    expect(edge.calls).toHaveLength(beforeNetwork);
    await refused(() => member.call(api,'POST',{...input,expectedVersion:0}),403,'Member workspace rule');
    await refused(() => guest.call(api+'/dry-run','POST',input),403,'Guest workspace dry run');
    await refused(() => member.call(teamApi,'POST',{...input,expectedVersion:0}),403,'Member team rule under team owners');
    const teamRule = await json(lead.call(teamApi,'POST',{...input,enabled:false,expectedVersion:0}),201);
    expect((await json(lead.call(teamApi))).rules[0]).toMatchObject({owner_operator_id:lead.id,version:1});
    await json(owner.call(`/settings/teams/${team}/permissions`,'PUT',{settings:'all_members',planning:'all_members'}));
    await json(member.call(teamApi,'POST',{...input,enabled:false,expectedVersion:0}),201);
    await refused(() => guest.call(teamApi,'POST',{...input,expectedVersion:0}),403,'Guest under all members');
    await json(owner.call(`/settings/teams/${team}/permissions`,'PUT',{settings:'team_owners',planning:'all_members'}));
    await refused(() => member.call(teamApi+'/'+teamRule.id,'PATCH',{...input,expectedVersion:1}),403,'Member after settings withdrawal');
    const viewer = await w.fresh('member');
    await json(owner.call('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer',teamIds:[]}));
    for (const path of [api,teamApi]) {
      await refused(() => viewer.call(path,'POST',{...input,expectedVersion:0}),403,'Viewer rule');
      await refused(() => viewer.call(path),403,'Viewer rule read');
      await refused(() => guest.call(path),403,'Guest rule read');
    }
    const saved = await json(admin.call(api,'POST',{...input,expectedVersion:0}),201);
    expect((await json(owner.call(api))).rules.find((row:any) => row.id === saved.id)).toMatchObject({label_id:label,destination_id:destination.id,priority:'urgent',owner_operator_id:admin.id,version:1});
    await refused(() => admin.call(api+'/'+saved.id,'PATCH',{...input,expectedVersion:0}),409,'stale rule save');
    const issue = await json(owner.call('/issues','POST',{teamId:team,title:'synthetic-vector-9401',priority:'low'}),201);
    const patch = (version:number,labelIds:string[]) => owner.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:version,labelIds});
    const native = await json(patch(issue.version,[label]));
    expect((await json(owner.call(api+'/'+saved.id+'/runs'))).runs).toHaveLength(1);
    expect(posts()).toHaveLength(0);
    await scheduled({scheduledTime:Date.parse('2030-05-17T10:00:00Z')},bindings);
    // Two workers observe the same receipt. Only the atomic winner may spend or act.
    await Promise.all([evaluateRules(bindings,new Date('2030-05-17T10:00:00Z')),evaluateRules(bindings,new Date('2030-05-17T10:00:00Z'))]);
    await dispatchWebhooks(bindings); await tick();
    const changed = await json(member.api('/issues/'+issue.identifier));
    expect(changed.activity).toContainEqual(expect.objectContaining({actor:expect.stringContaining('Owner: ')}));
    expect(changed.priority).toBe('urgent'); expect(changed.version).toBe(native.version+1);
    const log = await json(admin.call(api+'/'+saved.id+'/runs'));
    expect(log.runs).toHaveLength(1);
    expect(log.runs[0]).toMatchObject({state:'succeeded',issue_id:issue.id,changes_json:JSON.stringify([{field:'priority',from:'low',to:'urgent'}])});
    const activity = (await env.DB.prepare("SELECT * FROM issue_activity WHERE issue_id=? AND json_extract(next_value_json,'$.automationRuleId')=?").bind(issue.id,saved.id).all()).results;
    expect(activity).toHaveLength(1); expect(activity[0]).toMatchObject({actor_operator_id:admin.id,actor_name:'Automation: Security escalation'});
    const audit = await json(owner.call('/settings/audit?kind=automation&action=automation.rule.priority_changed'));
    expect(audit.entries).toContainEqual(expect.objectContaining({actorKind:'automation',actorRef:'automation:rule:'+saved.id,actorName:expect.any(String),subjectRef:issue.id}));
    expect(posts()).toHaveLength(1); expect(posts()[0].body).toMatchObject({channel:'CSECURITY',unfurl_links:false,unfurl_media:false});
    expect(posts()[0].body.text).toContain(issue.identifier);
    // Repeated additions, concurrent equal versions and removal alone have no extra run.
    await json(patch(changed.version,[label])); await tick(); expect(posts()).toHaveLength(1);
    let current = await json(owner.call('/issues/'+issue.identifier));
    const removed = await json(patch(current.version,[])); await tick(); expect(posts()).toHaveLength(1);
    const racing = await Promise.all([patch(removed.version,[label]),patch(removed.version,[label])]);
    expect(racing.map(row => row.status).sort()).toEqual([200,409]);
    await tick(); expect(posts()).toHaveLength(2);
    expect((await json(owner.call(api+'/'+saved.id+'/runs'))).runs).toHaveLength(2);
    // A fresh server sees the same terminal receipts; no second act or post.
    createServerApp(); await tick(); expect(posts()).toHaveLength(2);
    await automationWriters(w,input,saved.id,tick,posts);
    // One monthly slot, two concurrent eligible issues. The other is visibly stopped.
    const revision = (await json(owner.call(api))).rules.find((row:any) => row.id === saved.id).version;
    await json(admin.call(api+'/'+saved.id,'PATCH',{...input,monthlyBudget:1,expectedVersion:revision}));
    // An explicit budget change does not reset already consumed monthly usage.
    const exhausted = await json(owner.call('/issues','POST',{teamId:team,title:'synthetic-vector-9402',priority:'low',labelIds:[label]}),201);
    const mark = posts().length; await tick();
    expect((await json(owner.call('/issues/'+exhausted.identifier))).priority).toBe('low'); expect(posts()).toHaveLength(mark);
    expect((await json(owner.call(api+'/'+saved.id+'/runs'))).runs.find((row:any) => row.issue_id === exhausted.id)).toMatchObject({state:'budget_exhausted',reason:'monthly_budget_exhausted'});
    await automationSafety(w,edge);
    // Restore stops all old runs permanently, even after review. Proven separately with native archives.
    await automationArchive(w,saved.id);
    expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  } finally { edge.restore(); }
},240_000);
