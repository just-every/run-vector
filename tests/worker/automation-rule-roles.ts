import { expect } from 'vitest';
import type { roleWorkspace, Person } from './role-fixture';
import { channelEdge } from './channel-edge-fixture';
import { json } from './custom-fields-journey';
type Workspace = Awaited<ReturnType<typeof roleWorkspace>>;
/** Existing registry journey supplies every role and both team permission values. */
export async function automationRuleProbe(w:Workspace, actor:Person, teamId:string|null) {
  const edge=channelEdge();
  let input;
  try {
    const owner=w.people.owner;
    await json(owner.call('/settings/integrations/slack','POST',{botToken:edge.token}));
    const labelState=await json(owner.call('/settings/labels','POST',{name:'synthetic-vector-rule-'+crypto.randomUUID(),color:'#882222'}));
    const label=labelState.labels.at(-1) ?? labelState.labels[0];
    const destination=await json(owner.call('/settings/integrations/channels','POST',{scope:'team',objectId:teamId??w.team.id,provider:'slack',channelId:'CSECURITY',channelName:'security',events:['automation.rule']}),201);
    input={name:'synthetic-vector-rule',labelId:label.id,priority:'urgent',destinationId:destination.id,monthlyBudget:100,enabled:false,expectedVersion:0};
  } finally { edge.restore(); }
  const path=teamId?`/settings/teams/${teamId}/automation-rules`:'/settings/automation-rules';
  return async()=>{
    const response=await actor.call(path,'POST',input);
    if(response.ok) {
      const saved=await response.clone().json() as {id:string};
      const listed=await json(actor.call(path));
      expect(listed.rules).toContainEqual(expect.objectContaining({id:saved.id,owner_operator_id:actor.id,label_id:input.labelId}));
    }
    return response;
  };
}
