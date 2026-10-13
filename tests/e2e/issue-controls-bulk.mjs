import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { browserReceipt } from "./issue-controls-fixture.mjs";

export async function exerciseBulk(context, fixture, peer) {
  const {page,base}=context;
  const {api,a,b,intake,opts,backlog,started,team}=fixture;
  await page.goto(base+"/app/issues?q=Browse%20proof&sort=oldest");
  await settled(page);
  await page.getByLabel(`Select ${a.identifier}`,{exact:true}).check();
  await page.getByLabel(`Select ${b.identifier}`,{exact:true}).check();
  const bulk=page.getByRole("region",{name:"Bulk edit",exact:true});
  await bulk.waitFor();
  await auditBothWidths(context,"bulk-selection");
  const cycle=opts.cycles.find(c=>c.teamId===team.id);
  assert.ok(cycle,"bulk cycle target present");
  const operations=[["priority","medium"],["statusId",started.id],["assigneeOperatorId",opts.operators[0].id],["projectId",opts.projects[0].id],["cycleId",cycle.id],["labelIds",opts.labels[0].id]];
  for(const [field,value] of operations){
    await bulk.getByLabel("Change",{exact:true}).selectOption(field);
    if(field==="labelIds")await bulk.getByLabel(opts.labels[0].name,{exact:true}).check();
    else await bulk.getByLabel("Set to",{exact:true}).selectOption(value);
    const previous=await Promise.all([a,b].map(row=>api(`/api/issues/${row.identifier}`)));
    const receipt=await browserReceipt(page,"/api/issues/bulk","POST",()=>bulk.getByRole("button",{name:"Apply to selected",exact:true}).click());
    assert.equal(receipt.changed,2,`VIEW-004 ${field} changes both selected issues`);
    for(const identifier of [a.identifier,b.identifier]){
      const row=await api(`/api/issues/${identifier}`);
      assert.equal(row.activity.length,previous.find(before=>before.identifier===identifier).activity.length+1,`VIEW-004 one activity entry for ${identifier} ${field}`);
      const actual=field==="statusId"?row.status.id:field==="assigneeOperatorId"?row.assignee?.id:field==="projectId"?row.project?.id:field==="cycleId"?row.cycle.id:field==="labelIds"?row.labels.map(l=>l.id):row.priority;
      assert.deepEqual(actual,field==="labelIds"?[value]:value,`VIEW-004 ${identifier} persisted ${field}`);
    }
    await auditBothWidths(context,`bulk-success-${field}`);
  }
  // VIEW-004 mixed failures: stale selected issue, forbidden intake move, and a valid issue.
  await page.getByLabel(`Select ${intake.identifier}`,{exact:true}).check();
  const before=await api(`/api/issues/${a.identifier}`);
  await bulk.getByLabel("Change",{exact:true}).selectOption("statusId");
  await bulk.getByLabel("Set to",{exact:true}).selectOption(backlog.id);
  // The peer edits after the page sends its versions, so a list poll cannot refresh them first.
  let snapshots;
  const failed=await browserReceipt(page,"/api/issues/bulk","POST",()=>bulk.getByRole("button",{name:"Apply to selected",exact:true}).click(),409,async()=>{
    await peer.api(`/api/issues/${a.identifier}`,"PATCH",{expectedVersion:before.version,priority:"urgent"});
    snapshots=await Promise.all([a,b,intake].map(row=>api(`/api/issues/${row.identifier}`)));
  });
  assert.equal(failed.error,"bulk_edit_failed");
  assert.deepEqual(failed.failures.map(f=>f.identifier).sort(),[a.identifier,intake.identifier].sort(),"VIEW-004 every failing identifier is returned");
  assert.deepEqual(await Promise.all([a,b,intake].map(row=>api(`/api/issues/${row.identifier}`))),snapshots,"VIEW-004 mixed rejected batch writes nothing, including the valid issue");
  await page.getByText("Nothing was changed.",{exact:true}).waitFor();
  await auditBothWidths(context,"bulk-atomic-mixed-failure");
}
