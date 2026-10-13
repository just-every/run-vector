import assert from "node:assert/strict";
import { openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { browserReceipt } from "./issue-controls-fixture.mjs";

// Stored controls have loaded once the visible reset control is enabled.
async function controlsRestored(target){
  await settled(target);
  await target.waitForFunction(()=>[...document.querySelectorAll("button")].some(button=>/^Reset (controls|filters)$/.test(button.textContent.trim())&&!button.disabled&&button.getClientRects().length));
}
export async function exercisePersistence(context, fixture, peer, browser, cookie) {
  const {page,base}=context;
  const {api}=fixture;
  const second=await openAuthenticatedPage(browser,cookie,base);
  try {
    const cases=[
      {surface:"issues",route:"/app/issues",label:"Priority",value:"low",field:"priority"},
      {surface:"board",route:"/app/board",label:"Priority",value:"urgent",field:"priority"},
      {surface:"current",route:"/app/current",label:"Priority",value:"high",field:"priority"},
      {surface:"my-work",route:"/app/my-work",label:"Priority",value:"medium",field:"priority"},
      {surface:"projects",route:"/app/projects",label:"Health",value:"at-risk",field:"health"},
    ];
    for(const item of cases){
      await page.goto(base+item.route);
      await controlsRestored(page);
      const control=page.locator(item.surface==="current"||item.surface==="my-work"?".stream-filters":item.surface==="projects"?".project-filters":".issues-filters").getByLabel(item.label,{exact:true});
      await control.waitFor();
      await browserReceipt(page,`/api/preferences/${item.surface}`,"PUT",()=>control.selectOption(item.value));
      const saved=await api(`/api/preferences/${item.surface}`);
      assert.equal(saved.filters[item.field],item.value,`VIEW-003 ${item.surface} writes current operator controls`);
      await second.goto(base+item.route);
      await controlsRestored(second);
      const restored=second.locator(item.surface==="current"||item.surface==="my-work"?".stream-filters":item.surface==="projects"?".project-filters":".issues-filters").getByLabel(item.label,{exact:true});
      assert.equal(await restored.inputValue(),item.value,`VIEW-003 ${item.surface} restored in fresh browser context`);
      await auditBothWidths({...context,page:second},`preferences-${item.surface}-restored`);
      const peerValue=await peer.api(`/api/preferences/${item.surface}`);
      assert.equal(peerValue.filters[item.field],"all",`VIEW-003 ${item.surface} operator preference isolation`);
      await peer.page.goto(base+item.route);
      await controlsRestored(peer.page);
      const peerControl=peer.page.locator(item.surface==="current"||item.surface==="my-work"?".stream-filters":item.surface==="projects"?".project-filters":".issues-filters").getByLabel(item.label,{exact:true});
      assert.equal(await peerControl.inputValue(),"all",`VIEW-003 ${item.surface} peer browser restores its own defaults`);
      await auditBothWidths({...context,page:peer.page},`preferences-${item.surface}-peer-isolation`);
      await browserReceipt(second,`/api/preferences/${item.surface}`,"DELETE",()=>second.getByRole("button",{name:/^Reset (controls|filters)$/,exact:true}).click());
      assert.equal((await api(`/api/preferences/${item.surface}`)).filters[item.field],"all",`VIEW-003 ${item.surface} reset persists defaults`);
      await second.reload();
      await controlsRestored(second);
      assert.equal(await restored.inputValue(),"all",`VIEW-003 ${item.surface} reset survives reload`);
      await auditBothWidths({...context,page:second},`preferences-${item.surface}-reset`);
    }
  } finally {await second.context().close()}
}
