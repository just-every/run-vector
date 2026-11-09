import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { roleWorkspace } from './role-fixture';
import { resetLimits } from './role-fixture';
import { json } from './custom-fields-journey';
import { agentRequest, agentToolClient } from './agent-resource-journey';
import { origin } from './base-auth-fixture';
import { Buffer } from 'node:buffer';
type Workspace=Awaited<ReturnType<typeof roleWorkspace>>;
export async function automationWriters(w:Workspace,input:any,ruleId:string,tick:()=>Promise<void>,posts:()=>any[]) {
  const {owner,member}=w.people, label=input.labelId, teamId=w.team.id;
  const native=await json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-9403',priority:'low',labelIds:[label]}),201);
  const api=await json(member.api('/issues','POST',{teamId,title:'synthetic-vector-9404',priority:'low',labelIds:[label]}),201);
  const edit=await json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-9405',priority:'low'}),201);
  const viaApi=await json(member.api('/issues/'+edit.identifier,'PATCH',{expectedVersion:edit.version,labelIds:[label]}));
  const bulk=await json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-9406',priority:'low'}),201);
  await json(member.call('/issues/bulk','POST',{issues:[{identifier:bulk.identifier,expectedVersion:bulk.version}],changes:{labelIds:[label]}}));
  const template=await json(owner.call('/issue-templates','POST',{name:'synthetic-vector-9407',teamId,defaults:{priority:'low',labelIds:[label]}}),201);
  const fromTemplate=await json(member.call('/issues','POST',{teamId,templateId:template.id,templateVersion:template.version,title:'synthetic-vector-9408'}),201);
  const copied=await json(owner.call('/issues/'+native.identifier+'/copy','POST',{expectedVersion:native.version}),201);
  await resetLimits();
  await json(agentRequest('/agents/api/policy',{method:'PUT',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+owner.id],rules:[{id:'standard',class:'standard',do:'autonomous'},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}})}));
  const grant=await json(member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-9409',scopes:['issues:write']}),201),tool=agentToolClient(grant.token);
  const agentIssue=await json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-9410',priority:'low'}),201);
  const operation={identifier:agentIssue.identifier,change:{expectedVersion:agentIssue.version,labelIds:[label]},expected_revision:agentIssue.version,idempotency_key:crypto.randomUUID()};
  const agent=await tool('vector.issue.concurrent_edits',operation); expect(agent.status).toBe(200);
  // Idempotent offered-tool replay preserves the exact original trigger identity.
  expect((await tool('vector.issue.concurrent_edits',operation)).status).toBe(200);
  const createdByAgent=await tool('vector.issue.creation',{teamId,title:'synthetic-vector-9415',priority:'low',labelIds:[label],idempotency_key:crypto.randomUUID()});
  expect(createdByAgent.status).toBe(200);
  const agentCreated=await env.DB.prepare("SELECT id,identifier FROM issues WHERE title='synthetic-vector-9415'").first<{id:string;identifier:string}>();
  expect(agentCreated).not.toBeNull();
  const mark=posts().length;
  await tick();
  const expected=[native,api,viaApi,bulk,fromTemplate,copied.issue,agentIssue,agentCreated!];
  for(const issue of expected) {
    expect((await json(member.api('/issues/'+issue.identifier))).priority,issue.identifier).toBe('urgent');
    const receipts=(await env.DB.prepare('SELECT * FROM automation_rule_runs WHERE rule_id=? AND issue_id=?').bind(ruleId,issue.id).all()).results;
    expect(receipts,issue.identifier).toHaveLength(1); expect(receipts[0].state).toBe('succeeded');
  }
  expect(posts()).toHaveLength(mark+expected.length);
  await tick(); expect(posts()).toHaveLength(mark+expected.length);
  // Label consolidation introduces the destination only if it was absent.
  const merging=await json(owner.call('/settings/labels','POST',{name:'synthetic-vector-merge-source',color:'#115588'}));
  const sourceLabel=merging.labels.find((l:any)=>l.name==='synthetic-vector-merge-source').id;
  const mergedIssue=await json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-9416',priority:'low',labelIds:[sourceLabel]}),201);
  await json(owner.call('/settings/labels/'+sourceLabel+'/merge','POST',{destinationLabelId:label}));
  const beforeMerge=posts().length;await tick();expect(posts()).toHaveLength(beforeMerge+1);
  expect((await json(owner.call('/issues/'+mergedIssue.identifier))).priority).toBe('urgent');
  // Nonmatching labels and removal do not enqueue. Imports carry labels but no native trigger.
  const otherLabelState=await json(owner.call('/settings/labels','POST',{name:'synthetic-vector-9411',color:'#224499'})),otherLabel=otherLabelState.labels.find((row:any)=>row.name==='synthetic-vector-9411').id;
  const nonmatch=await json(owner.call('/issues','POST',{teamId,title:'synthetic-vector-9412',labelIds:[otherLabel]}),201);
  expect((await env.DB.prepare('SELECT id FROM automation_rule_runs WHERE issue_id=?').bind(nonmatch.id).all()).results).toEqual([]);
  const currentTeam=(await w.state()).teams.find(row=>row.id===teamId)!;
  const rows=[{id:'synthetic-vector-9413',title:'synthetic-vector-9414',team:currentTeam.name,status:currentTeam.statuses.find(row=>row.category==='backlog')!.name,priority:'low',labels:'Security',created:'2026-09-01T01:02:03.000Z',updated:'2026-09-02T04:05:06.000Z'}];
  const importInput={format:'json',source:'synthetic-vector-rules',name:'issues.json',base64:Buffer.from(JSON.stringify(rows)).toString('base64'),mapping:{sourceId:'id',title:'title',team:'team',status:'status',priority:'priority',labels:'labels',createdAt:'created',updatedAt:'updated'}};
  const review=await json(owner.call('/data/import/preview','POST',importInput)); expect(review.errors).toEqual([]);
  let run=await json(owner.call('/data/import/apply','POST',{input:{...importInput,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'review:'+review.fingerprint,acknowledgeOmissions:true}));
  for(let attempt=0;run.state!=='completed';attempt++) { expect(attempt).toBeLessThan(50); run=await json(owner.call('/data/import/runs/'+run.id+'/resume','POST',{})); }
  const imported=await env.DB.prepare("SELECT id,priority FROM issues WHERE title='synthetic-vector-9414'").first<{id:string;priority:string}>();
  expect((await env.DB.prepare('SELECT label_id FROM issue_labels WHERE issue_id=?').bind(imported!.id).all()).results).toContainEqual({label_id:label});
  await tick(); expect(imported!.priority).toBe('low');
  expect((await env.DB.prepare('SELECT id FROM automation_rule_runs WHERE issue_id=?').bind(imported!.id).all()).results).toEqual([]);
}
