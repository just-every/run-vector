import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { roleWorkspace } from './role-fixture';
import { destination, finalBody, freshTarget, httpExport, stageArchive, targetCall, targetBindings, targetSignIn } from './http-archive-fixture';
import { resetLimits } from './role-fixture';
import { json } from './custom-fields-journey';
import type { RuleInput } from '../../src/core/features/automation-rules/schema';
import { evaluateRules } from '../../src/core/features/automation-rules/evaluation';
import { dispatchWebhooks } from '../../src/core/features/integrations/outbound';
export async function automationArchive(w:Awaited<ReturnType<typeof roleWorkspace>>,ruleId:string,input:RuleInput,posts:()=>unknown[]) {
  await resetLimits();
  // Carry a genuinely unprocessed native addition through the archive, as well
  // as the completed and failed history proved above.
  const pending=await json(w.people.owner.call('/issues','POST',{teamId:w.team.id,title:'synthetic-vector-restored-pending',priority:'low',labelIds:[input.labelId]}),201);
  expect(await env.DB.prepare("SELECT state FROM automation_rule_runs WHERE rule_id=? AND issue_id=?").bind(ruleId,pending.id).first('state')).toBe('pending');
  const records=await httpExport(w.people.owner.call),cookie=await freshTarget();
  const job=await stageArchive(records,cookie),response=await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie);
  expect(response.status,await response.clone().text()).toBe(200);
  for(const table of ['automation_rules','automation_rule_runs','automation_rule_usage']) {
    const read=async(db:D1Database)=>(await db.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all()).results;
    expect((await read(env.DB)).length).toBeGreaterThan(0);
    expect(await read(destination.ARCHIVE_TARGET_DB)).toEqual(await read(env.DB));
  }
  expect(await destination.ARCHIVE_TARGET_DB.prepare('SELECT 1 FROM automation_rule_restore_holds WHERE rule_id=?').bind(ruleId).first()).not.toBeNull();
  const restored=destination.ARCHIVE_TARGET_DB,mark=posts().length;
  const tick=async()=>{await evaluateRules(targetBindings,new Date('2030-05-17T10:00:00Z'));await dispatchWebhooks(targetBindings);};
  const unchanged=async(state='pending')=>{
    expect(await restored.prepare('SELECT priority FROM issues WHERE id=?').bind(pending.id).first('priority')).toBe('low');
    expect(await restored.prepare('SELECT state FROM automation_rule_runs WHERE rule_id=? AND issue_id=?').bind(ruleId,pending.id).first('state')).toBe(state);
    expect(posts()).toHaveLength(mark);
  };
  await tick();await unchanged();
  const ownerCookie=await targetSignIn();
  const call=(path:string,method='GET',body?:unknown)=>targetCall('/api'+path,method,body,ownerCookie);
  await json(call('/data/restore/review-effects','POST'));
  await tick();await unchanged('stopped');
  // Fresh native edits while per-rule holds remain produce no new receipts.
  const duringHold=await json(call('/issues','POST',{teamId:w.team.id,title:'synthetic-vector-held-addition',priority:'low',labelIds:[input.labelId]}),201);
  expect((await restored.prepare('SELECT id FROM automation_rule_runs WHERE issue_id=?').bind(duringHold.id).all()).results).toEqual([]);
  const rule=(await json(call('/settings/automation-rules'))).rules.find((r:any)=>r.id===ruleId);
  await json(call('/settings/automation-rules/'+ruleId,'PATCH',{...input,enabled:false,expectedVersion:rule.version}));
  expect(await restored.prepare('SELECT state FROM automation_rule_runs WHERE rule_id=? AND issue_id=?').bind(ruleId,pending.id).first('state')).toBe('stopped');
  await tick();expect(posts()).toHaveLength(mark);
  expect(await restored.prepare('SELECT priority FROM issues WHERE id=?').bind(pending.id).first('priority')).toBe('low');
}
