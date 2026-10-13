import assert from "node:assert/strict";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { browserReceipt } from "./issue-controls-fixture.mjs";
import { assertSavedViewCaptureIntegrity } from "./saved-view-capture-integrity.mjs";
import { exerciseSavedViewLifetime } from "./saved-view-lifetime.mjs";
import { exerciseSavedViewCreationReceipt } from "./saved-view-creation-receipt.mjs";
import { observeSavedViewPatch, savedViewPatchProcessed, restoreSavedViewPatchObserver } from "./saved-view-response-observer.mjs";
import { savedViewHeldResponses, finishSavedViewProbe } from "./saved-view-held-responses.mjs";

export async function exerciseViews(context, fixture, peer) {
  const {page,base}=context;
  const firstAudit=context.results.length;
  const {api}=fixture;
  await exerciseViewReceiptRace(context, fixture);
  await exerciseSavedViewLifetime(context, fixture);
  await exerciseSavedViewCreationReceipt(context, fixture);
  await page.goto(base+"/app/issues");
  await settled(page);
  await page.getByLabel("Priority",{exact:true}).selectOption("high");
  await page.getByLabel("Sort",{exact:true}).selectOption("oldest");
  await page.getByLabel("Group by",{exact:true}).selectOption("priority");
  await settled(page);
  const before=await api("/api/preferences/issues");
  await page.getByRole("button",{name:"Save view",exact:true}).click();
  await page.getByLabel("View name",{exact:true}).fill("Browse proof shared");
  await page.getByLabel("Shared with workspace",{exact:true}).check();
  await auditBothWidths(context,"view-create-form");
  const shared=await browserReceipt(page,"/api/views","POST",()=>page.getByRole("button",{name:"Create view",exact:true}).click(),201);
  await page.waitForURL(base+`/app/views/${shared.id}`);
  await page.getByRole("heading",{name:shared.name,exact:true}).waitFor();
  assert.equal(shared.query.priority,"high","VIEW-002 saved controls retained");
  await auditBothWidths(context,"shared-view-owner");
  // VIEW-002: at 390 saved views are reachable from the browsing pages.
  const desktop=page.viewportSize();
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+"/app/issues");
  await page.getByText("Board and saved views",{exact:true}).click();
  await page.locator(".app-mobile-views").getByRole("link",{name:new RegExp(shared.name)}).click();
  await page.waitForURL(base+`/app/views/${shared.id}`);
  await page.getByRole("heading",{name:shared.name,exact:true}).waitFor();
  await page.setViewportSize(desktop);
  await page.getByLabel("Priority",{exact:true}).selectOption("urgent");
  await page.getByLabel("View name",{exact:true}).fill("Browse proof shared renamed");
  await browserReceipt(page,`/api/views/${shared.id}`,"PATCH",()=>page.getByRole("button",{name:"Update saved controls",exact:true}).click());
  await page.getByRole("heading",{name:"Browse proof shared renamed",exact:true}).waitFor();
  assert.equal((await api(`/api/views/${shared.id}`)).query.priority,"urgent");
  assert.deepEqual(await api("/api/preferences/issues"),before,"VIEW-003 saved view never changes origin preferences");
  await auditBothWidths(context,"shared-view-updated");
  const boardBefore=await api("/api/preferences/board");
  await page.getByLabel("View layout",{exact:true}).selectOption("board");
  await page.getByLabel("Board team",{exact:true}).selectOption(fixture.team.id);
  await auditBothWidths(context,"saved-view-board-layout");
  assert.deepEqual(await api("/api/preferences/board"),boardBefore,"VIEW-003 saved board is independent of board preferences");
  await page.getByLabel("View layout",{exact:true}).selectOption("list");
  await page.locator(`#issue-row-${fixture.b.identifier}`).click();
  await page.locator(".issue-inspector").waitFor();
  await auditBothWidths(context,"saved-view-issue-detail");
  await page.getByRole("button",{name:/Back to list/}).click();
  await page.getByRole("heading",{name:"Browse proof shared renamed",exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,`/app/views/${shared.id}`,"VIEW-003 Back returns to saved view context");
  assert.deepEqual(await api("/api/preferences/issues"),before,"VIEW-003 view issue and Back leave originating Issues controls unchanged");
  assert.deepEqual(await api("/api/preferences/board"),boardBefore,"VIEW-003 view issue and Back leave Board controls unchanged");
  await auditBothWidths(context,"saved-view-issue-return");
  await peer.page.goto(base+`/app/views/${shared.id}`);
  await peer.page.getByRole("heading",{name:"Browse proof shared renamed",exact:true}).waitFor();
  assert.equal(await peer.page.getByRole("button",{name:"Update saved controls",exact:true}).count(),0,"VIEW-002 shared nonowner cannot update UI");
  assert.equal(await peer.page.getByRole("button",{name:"Delete view",exact:true}).count(),0,"VIEW-002 shared nonowner cannot delete UI");
  await peer.api(`/api/views/${shared.id}`,"PATCH",{name:"Forbidden"},403);
  await peer.api(`/api/views/${shared.id}`,"DELETE",undefined,403);
  await auditBothWidths({...context,page:peer.page},"shared-view-peer");
  await peer.page.getByLabel("Duplicate name",{exact:true}).fill("Browse proof peer duplicate");
  const duplicate=await browserReceipt(peer.page,`/api/views/${shared.id}/duplicate`,"POST",()=>peer.page.getByRole("button",{name:"Duplicate view",exact:true}).click(),201);
  assert.notEqual(duplicate.ownerOperatorId,shared.ownerOperatorId,"VIEW-002 duplicate owned by actor");
  assert.equal(duplicate.isShared,false,"VIEW-002 duplicate private by default");
  await peer.page.waitForURL(base+`/app/views/${duplicate.id}`);
  await auditBothWidths({...context,page:peer.page},"shared-view-peer-duplicate");
  const privateView=await api("/api/views","POST",{name:"Browse proof private secret",isShared:false,layout:"list",query:shared.query},201);
  assert.equal((await peer.api("/api/views")).views.some(v=>v.id===privateView.id),false,"VIEW-002 private excluded from nav source");
  await peer.api(`/api/views/${privateView.id}`,"GET",undefined,404);
  await peer.api(`/api/views/${privateView.id}`,"PATCH",{name:"Forbidden"},404);
  await peer.api(`/api/views/${privateView.id}`,"DELETE",undefined,404);
  await peer.api(`/api/views/${privateView.id}/duplicate`,"POST",{name:"Forbidden"},404);
  assert.equal((await peer.api("/api/search?q=Browse%20proof%20private%20secret")).savedViews.length,0,"VIEW-002 private excluded from search");
  await peer.page.goto(base+"/app/issues");
  await settled(peer.page);
  assert.equal(await peer.page.getByRole("link",{name:/Browse proof private secret/}).count(),0,"VIEW-002 private absent nav");
  await peer.page.getByRole("button",{name:/Search/}).filter({visible:true}).first().click();
  const palette=peer.page.getByRole("dialog",{name:"Command palette"});
  await palette.getByRole("textbox",{name:"Search issues, projects, and commands"}).fill(privateView.name);
  await settled(peer.page);
  assert.equal(await palette.getByRole("option",{name:new RegExp(privateView.name)}).count(),0,"VIEW-002 private absent palette");
  await auditBothWidths({...context,page:peer.page},"palette-private-view-hidden");
  await peer.page.keyboard.press("Escape");
  await peer.page.goto(base+`/app/views/${privateView.id}`);
  await peer.page.getByText("This view is unavailable.",{exact:false}).waitFor();
  await auditBothWidths({...context,page:peer.page},"private-view-peer-unavailable");
  await page.goto(base+`/app/views/${privateView.id}`);
  await page.getByRole("heading",{name:privateView.name,exact:true}).waitFor();
  await auditBothWidths(context,"private-view-owner");
  await exerciseSavedViewPalette(context, {...shared,name:"Browse proof shared renamed"}, "click", api);
  await exerciseSavedViewPalette(context, privateView, "click", api);
  await exerciseSavedViewPalette({...context,page:peer.page}, {...shared,name:"Browse proof shared renamed"}, "keyboard", peer.api);
  await page.getByLabel("View name",{exact:true}).fill("Browse proof now shared");
  await page.getByLabel("Shared with workspace",{exact:true}).check();
  await browserReceipt(page,`/api/views/${privateView.id}`,"PATCH",()=>page.getByRole("button",{name:"Rename / visibility",exact:true}).click());
  assert.equal((await peer.api(`/api/views/${privateView.id}`)).isShared,true,"VIEW-002 owner can share private view");
  await page.getByRole("button",{name:"Delete view",exact:true}).click();
  await auditBothWidths(context,"view-delete-confirmation");
  const issueBefore=await api(`/api/issues/${fixture.a.identifier}`);
  await browserReceipt(page,`/api/views/${privateView.id}`,"DELETE",()=>page.getByRole("button",{name:"Confirm delete",exact:true}).click());
  await page.waitForURL(url=>new URL(url).pathname==="/app/issues");
  assert.deepEqual(await api(`/api/issues/${fixture.a.identifier}`),issueBefore,"VIEW-002 deleting view leaves issue unchanged");
  await api(`/api/views/${privateView.id}`,"GET",undefined,404);
  await assertSavedViewCaptureIntegrity(context.results.slice(firstAudit),context.evidence);
  return shared;
}


// Hold genuine response bodies, never the mutation. The receipt must render
// before either the detail read or the independently mounted nav reads finish.
export async function exerciseViewReceiptRace(context, fixture) {
  const {page,base}=context;
  const originalViewport=page.viewportSize();
  try {
  const before=await fixture.api("/api/preferences/issues");
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:900});
    const initial=await fixture.api("/api/views","POST",{name:`Receipt proof ${width}`,isShared:false,layout:"list",query:{priority:"high"}},201);
    await page.goto(base+`/app/views/${initial.id}`);
    await page.getByRole("heading",{name:initial.name,exact:true}).waitFor();
    await settled(page);
    const held=[];
    const transport=savedViewHeldResponses(page);
    const inspect=row=>held.push({path:row.path,body:row.text});
    await transport.hold("/api/views","GET",{inspect});
    await transport.hold(`/api/views/${initial.id}`,"GET",{inspect});
    let primaryFailure=null;
    try {
      await page.getByLabel("Priority",{exact:true}).selectOption("urgent");
      await page.getByLabel("View layout",{exact:true}).selectOption("board");
      await page.getByLabel("View name",{exact:true}).fill(`Receipt proof ${width} first`);
      await browserReceipt(page,`/api/views/${initial.id}`,"PATCH",()=>page.getByRole("button",{name:"Rename / visibility",exact:true}).click());
      await page.getByRole("heading",{name:`Receipt proof ${width} first`,exact:true}).waitFor({timeout:3000});
      await waitForRead(page,()=>held.some(read=>read.path===`/api/views/${initial.id}`),transport.errors);
      assert.equal(await page.getByLabel("Priority",{exact:true}).inputValue(),"urgent","VIEW-003 metadata receipt preserves draft query");
      assert.equal(await page.getByLabel("View layout",{exact:true}).inputValue(),"board","VIEW-003 metadata receipt preserves draft layout");
      await page.getByLabel("View layout",{exact:true}).selectOption("list");
      await page.getByLabel("View name",{exact:true}).fill(`Receipt proof ${width} final`);
      await browserReceipt(page,`/api/views/${initial.id}`,"PATCH",()=>page.getByRole("button",{name:"Update saved controls",exact:true}).click());
      await page.getByRole("heading",{name:`Receipt proof ${width} final`,exact:true}).waitFor({timeout:3000});
      assert.equal(await page.getByLabel("View name",{exact:true}).inputValue(),`Receipt proof ${width} final`,"VIEW-002 actions use latest receipt");
      if(width===390) await page.getByText("Board and saved views",{exact:true}).click();
      const nav=page.locator(width===390?".app-mobile-views":".app-sidebar");
      await nav.getByRole("link",{name:new RegExp(`Receipt proof ${width} final`)}).waitFor({timeout:3000});
      await waitForRead(page,()=>held.filter(read=>read.path===`/api/views/${initial.id}`).length>=2 && held.filter(read=>read.path==="/api/views").length>=2,transport.errors);
      assert.ok(held.some(read=>JSON.parse(read.body)?.name===`Receipt proof ${width} first`),"VIEW-002 older genuine GET body is held through second PATCH");
      assert.ok(held.some(read=>JSON.parse(read.body)?.views?.some(view=>view.id===initial.id && view.name===`Receipt proof ${width} first`)),"VIEW-002 older genuine navigation body is held through second PATCH");
      if(width===390) await page.getByText("Board and saved views",{exact:true}).click();
      await auditBothWidths(context,`view-receipt-before-get-${width}`);
    } catch(error) {
      primaryFailure=error;
      await context.recordFailure?.(error);
    } finally {
      await finishSavedViewProbe(context,transport,primaryFailure);
    }
    await settled(page);
    assert.equal(await page.getByRole("heading",{level:1}).textContent(),`Receipt proof ${width} final`,"VIEW-002 older delayed GET cannot roll back PATCH receipt");
    if(width===390) await page.getByText("Board and saved views",{exact:true}).click();
    const nav=page.locator(width===390?".app-mobile-views":".app-sidebar");
    await nav.getByRole("link",{name:new RegExp(`Receipt proof ${width} final`)}).waitFor();
    assert.equal(await nav.getByRole("link",{name:new RegExp(`Receipt proof ${width} first`)}).count(),0,"VIEW-002 old navigation GET cannot roll back receipt");
    if(width===390) await page.getByText("Board and saved views",{exact:true}).click();
    await page.reload();
    await page.getByRole("heading",{name:`Receipt proof ${width} final`,exact:true}).waitFor();
    assert.equal(await page.getByLabel("Priority",{exact:true}).inputValue(),"urgent","VIEW-002 receipt persists on reload");
    await fixture.api(`/api/views/${initial.id}`,"DELETE");
  }
  assert.deepEqual(await fixture.api("/api/preferences/issues"),before,"VIEW-003 receipt updates never write originating controls");
  await exerciseReceiptDenial(context,fixture);
  } finally {
    await page.setViewportSize(originalViewport);
  }
}

export async function exerciseSavedViewPalette(context, view, action, api) {
  const {page,base}=context;
  const alternate=action==="keyboard"
    ? await api("/api/views","POST",{name:`${view.name} keyboard alternate`,query:{}},201)
    : null;
  try {
    await page.getByRole("button",{name:/Search/}).filter({visible:true}).first().click();
    const palette=page.getByRole("dialog",{name:"Command palette"});
    const input=palette.getByRole("textbox",{name:"Search issues, projects, and commands"});
    await input.fill(view.name);
    const group=palette.getByRole("group",{name:"Saved views",exact:true});
    const option=group.getByRole("option",{name:new RegExp(`^${view.name} (Shared|Private) saved view`)});
    await option.waitFor({timeout:3000});
    await auditBothWidths(context,`palette-saved-view-${view.isShared?"shared":"private"}-${action}`);
    if(action==="keyboard") {
      assert.ok(await group.getByRole("option").count()>=2,"CMD-001 arrows operate on at least two genuine authorized views");
      const initial=await input.getAttribute("aria-activedescendant");
      await input.press("ArrowDown");
      assert.notEqual(await input.getAttribute("aria-activedescendant"),initial,"CMD-001 ArrowDown changes highlight");
      await input.press("ArrowUp");
      assert.equal(await input.getAttribute("aria-activedescendant"),initial,"CMD-001 ArrowUp restores highlight");
      for(let step=0;await option.getAttribute("aria-selected")!=="true";step++) {
        assert.ok(step<await palette.getByRole("option").count(),"CMD-001 target is keyboard reachable");
        await input.press("ArrowDown");
      }
      await input.press("Enter");
    } else await option.click();
    await page.waitForURL(base+`/app/views/${view.id}`);
    await page.getByRole("heading",{name:view.name,exact:true}).waitFor();
    assert.equal(await palette.count(),0,"CMD-001 selection dismisses palette");
    await auditBothWidths(context,`palette-saved-view-open-${view.isShared?"shared":"private"}-${action}`);
  } finally {
    if(alternate) await api(`/api/views/${alternate.id}`,"DELETE");
  }
}

// The denial is genuine: remove the saved view after PATCH succeeded, then let
// the delayed GET reach the server. No private receipt may survive its 404.
async function exerciseReceiptDenial(context,fixture) {
  const {page,base}=context;
  const view=await fixture.api("/api/views","POST",{name:"Private receipt denial",query:{priority:"high"}},201);
  await page.goto(base+`/app/views/${view.id}`);
  await page.getByRole("heading",{name:view.name,exact:true}).waitFor();
  const transport=savedViewHeldResponses(page,{allowRetiredReads:false});
  const path=`/api/views/${view.id}`;
  let detailRead, latePatch;
  let navigationRead=false, holdNavigation=false;
  let primaryFailure=null;
  try {
    detailRead=await transport.hold(path,"GET",{beforeFetch:true,inspect:row=>{
      assert.equal(row.status,404,"VIEW-002 delayed GET is real server denial");
    }});
    await page.getByLabel("View name",{exact:true}).fill("Private receipt denied after save");
    await browserReceipt(page,`/api/views/${view.id}`,"PATCH",()=>page.getByRole("button",{name:"Rename / visibility",exact:true}).click());
    await page.getByRole("heading",{name:"Private receipt denied after save",exact:true}).waitFor({timeout:3000});
    latePatch=await transport.hold(path,"PATCH",{inspect:row=>{
      assert.equal(row.status,200,"VIEW-002 genuine delayed PATCH succeeded before denial");
    }});
    await observeSavedViewPatch(page,base,`/api/views/${view.id}`);
    await page.getByLabel("View name",{exact:true}).fill("Delayed private receipt after denial");
    await page.getByRole("button",{name:"Rename / visibility",exact:true}).click();
    await waitForRead(page,()=>latePatch.rows.length>0,transport.errors);
    await fixture.api(`/api/views/${view.id}`,"DELETE");
    await transport.hold("/api/views","GET",{shouldHold:()=>holdNavigation,inspect:row=>{
      assert.equal(row.status,200);
      assert.equal(row.body.views.some(item=>item.id===view.id),false,"VIEW-002 fresh authorized navigation read confirms deletion");
      navigationRead=true;
    }});
    detailRead.release();
    await page.getByText("This view is unavailable.",{exact:false}).waitFor();
    await context.recordStage?.("detail-denied");
    await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
    await waitForRead(page,()=>navigationRead,transport.errors);
    await page.waitForFunction(name=>![...document.querySelectorAll(".saved-view-navigation a")].some(link=>link.textContent.includes(name)),"Private receipt denied after save");
    holdNavigation=true;
    await context.recordStage?.("navigation-confirmed-deletion");
    latePatch.release();
    await waitForRead(page,()=>latePatch.delivered>0,transport.errors);
    await savedViewPatchProcessed(page,{id:view.id,name:"Delayed private receipt after denial"});
    await page.getByRole("heading",{name:"Saved view",exact:true}).waitFor();
    await context.recordStage?.("late-receipt-processed");
    assert.equal(await page.locator(".saved-view-navigation a").filter({hasText:"Delayed private receipt after denial"}).count(),0,"VIEW-002 known detail denial and fresh empty navigation read override delayed private PATCH in navigation");
    for(const name of ["Private receipt denied after save","Delayed private receipt after denial"])
      assert.equal(await page.locator("main").getByText(name,{exact:true}).count(),0,"VIEW-002 denial overrides both existing and delayed private receipts");
    assert.equal(await page.getByRole("region",{name:"Saved view actions"}).count(),0);
    assert.equal(await page.locator("main[data-list-query]").count(),0,"VIEW-002 denial clears query and issues");
    await auditBothWidths(context,"private-view-receipt-denied");
  } catch(error) {
    primaryFailure=error;
    await context.recordFailure?.(error);
  } finally {
    await finishSavedViewProbe(context,transport,primaryFailure,()=>restoreSavedViewPatchObserver(page));
  }
}

async function waitForRead(page, ready, errors=[]) {
  for(let waited=0;!ready();waited+=50) {
    assert.deepEqual(errors,[],"VIEW-002 genuine delayed route errors");
    assert.ok(waited<5000,"VIEW-002 genuine delayed read arrived");
    await page.waitForTimeout(50);
  }
}
