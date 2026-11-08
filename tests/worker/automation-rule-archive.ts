import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import type { roleWorkspace } from './role-fixture';
import { destination, finalBody, freshTarget, httpExport, stageArchive, targetCall } from './http-archive-fixture';
import { resetLimits } from './role-fixture';
export async function automationArchive(w:Awaited<ReturnType<typeof roleWorkspace>>,ruleId:string) {
  await resetLimits();
  const records=await httpExport(w.people.owner.call),cookie=await freshTarget();
  const job=await stageArchive(records,cookie),response=await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie);
  expect(response.status,await response.clone().text()).toBe(200);
  for(const table of ['automation_rules','automation_rule_runs','automation_rule_usage']) {
    const read=async(db:D1Database)=>(await db.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all()).results;
    expect((await read(env.DB)).length).toBeGreaterThan(0);
    expect(await read(destination.ARCHIVE_TARGET_DB)).toEqual(await read(env.DB));
  }
  expect(await destination.ARCHIVE_TARGET_DB.prepare('SELECT 1 FROM automation_rule_restore_holds WHERE rule_id=?').bind(ruleId).first()).not.toBeNull();
}
