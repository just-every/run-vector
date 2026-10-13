import { exercisePagedBoard } from "./issue-paging-board.mjs";
import { exerciseConcentratedBoard } from "./issue-board-concentrated.mjs";
import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { browserReceipt } from "./issue-controls-fixture.mjs";

export async function exerciseBoard(context, fixture, peer) {
  const { page, base } = context;
  const { api, a, intake, team, opts, backlog, started } = fixture;
  await page.goto(base + "/app/board");
  await page.getByRole("heading",{name:"Board",exact:true}).waitFor();
  await auditBothWidths(context,"board-team-required");
  await page.getByLabel("Board team",{exact:true}).selectOption(team.id);
  await page.getByLabel("Title or identifier").fill("Browse proof");
  await page.getByLabel("Sort",{exact:true}).selectOption("oldest");
  await settled(page);
  await auditBothWidths(context,"board-workflow-columns");
  const statuses = opts.statuses.filter(s=>s.teamId===team.id).sort((a,b)=>a.position-b.position);
  assert.equal(await page.locator(".board-column").count(),statuses.length,"VIEW-005 every workflow column present");
  const rendered=await api("/api/issues"+new URL(page.url()).search);
  for(let index=0;index<statuses.length;index++)assert.deepEqual(await page.locator(".board-column").nth(index).locator(".board-card-open small").allTextContents(),rendered.issues.filter(row=>row.status.id===statuses[index].id).map(row=>row.identifier),`VIEW-005 ${statuses[index].name} cards obey page and sort`);
  assert.equal(await page.getByRole("navigation",{name:"Issue pages",exact:true}).count(),1,"VIEW-005 paging remains available on board");
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel("Board column",{exact:true}).selectOption(backlog.id);
  assert.equal(await page.locator(".board-column:visible").count(),1,"VIEW-005 mobile exposes one selected column");
  await auditBothWidths(context,"board-mobile-column");
  const preferenceBefore=await api("/api/preferences/board");
  await page.locator(".board-card-open").filter({hasText:a.identifier}).click();
  await page.locator(".issue-inspector").waitFor();
  await auditBothWidths(context,"board-issue-detail");
  await page.getByRole("button",{name:/Back to list/}).click();
  await page.getByRole("heading",{name:"Board",exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,"/app/board","VIEW-005 Back preserves Board context");
  assert.deepEqual(await api("/api/preferences/board"),preferenceBefore,"VIEW-003 board issue and Back preserve stored board controls");
  await auditBothWidths(context,"board-issue-return");
  const picker=page.getByLabel(`Status for ${a.identifier}`,{exact:true});
  const index=statuses.findIndex(s=>s.id===backlog.id);
  assert.ok(statuses[index+1] && statuses[index+1].category!=="intake","fixture has next nonintake workflow state");
  // Type-ahead on the focused status control works with the keyboard alone on every platform.
  const moved=await browserReceipt(page,`/api/issues/${a.identifier}`,"PATCH",async()=>{
    await picker.focus();
    await page.keyboard.type(statuses[index+1].name);
  });
  assert.equal(moved.status.id,statuses[index+1].id,"VIEW-005 keyboard moves workflow card");
  await page.reload();
  await settled(page);
  await page.getByLabel("Board column",{exact:true}).selectOption(moved.status.id);
  assert.equal(await page.getByLabel(`Status for ${a.identifier}`,{exact:true}).inputValue(),moved.status.id,"VIEW-005 board move persists reload");
  await auditBothWidths(context,"board-keyboard-move-persisted");
  const intakeStatus=(await api(`/api/issues/${intake.identifier}`)).status.id;
  await page.getByLabel("Board column",{exact:true}).selectOption(intakeStatus);
  await browserReceipt(page,`/api/issues/${intake.identifier}`,"PATCH",()=>page.getByLabel(`Status for ${intake.identifier}`,{exact:true}).selectOption(started.id),409);
  assert.equal((await api(`/api/issues/${intake.identifier}`)).status.category,"intake","ISSUE-004 board cannot bypass intake decision");
  await auditBothWidths(context,"board-refused-intake");
  await page.getByLabel("Board column",{exact:true}).selectOption(moved.status.id);
  const before=await api(`/api/issues/${a.identifier}`);
  const relocated=await peer.api(`/api/issues/${a.identifier}`,"PATCH",{expectedVersion:before.version,statusId:backlog.id});
  const stale=await browserReceipt(page,`/api/issues/${a.identifier}`,"PATCH",()=>page.getByLabel(`Status for ${a.identifier}`,{exact:true}).selectOption(started.id),409);
  assert.equal(stale.error,"stale_version","ISSUE-006 board stale write refused");
  assert.equal((await api(`/api/issues/${a.identifier}`)).status.id,relocated.status.id,"stale board move cannot overwrite server relocation");
  await page.getByRole("alert").filter({hasText:/changed elsewhere/}).waitFor();
  await auditBothWidths(context,"board-stale-conflict");
  await exercisePagedBoard(context, fixture);
  await exerciseConcentratedBoard(context, fixture);

}
