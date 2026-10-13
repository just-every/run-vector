import assert from "node:assert/strict";
import { createBrowseFixture, signInBrowsePeer } from "./issue-controls-fixture.mjs";
import { exerciseBrowse } from "./issue-controls-browse.mjs";
import { exerciseViews } from "./issue-controls-views.mjs";
import { exercisePersistence } from "./issue-controls-persistence.mjs";
import { exerciseBoard } from "./issue-controls-board.mjs";
import { exerciseBulk } from "./issue-controls-bulk.mjs";
import { exerciseParents } from "./issue-controls-parent.mjs";
import { exerciseSearch } from "./issue-controls-search.mjs";
import { exerciseIssueEditorReceipts } from "./issue-editor-receipt-journeys.mjs";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { assertIssueListKeyboard } from "./ui-controls-checks.mjs";

export async function exerciseIssueControls(context) {
  const {runtime,browser,cookie,opts,page,base}=context;
  await runtime.freshRequestWindow();
  const fixture=await createBrowseFixture(runtime,cookie,opts);
  const peer=await signInBrowsePeer(runtime,browser,page.viewportSize());
  const errors=[];
  const recordError=error=>errors.push(error.message);
  page.on("pageerror",recordError);
  peer.page.on("pageerror",recordError);
  try {
    await exerciseBrowse(context,fixture);
    await page.goto(base+"/app/issues?q=Browse%20proof&sort=oldest");
    await settled(page);
    await assertIssueListKeyboard(page,[fixture.a.identifier,fixture.b.identifier],name=>auditBothWidths(context,name));
    await runtime.freshRequestWindow();
    await exerciseViews(context,fixture,peer);
    await runtime.freshRequestWindow();
    await exercisePersistence(context,fixture,peer,browser,cookie);
    await runtime.freshRequestWindow();
    await exerciseBoard(context,fixture,peer);
    await runtime.freshRequestWindow();
    await exerciseBulk(context,fixture,peer);
    await runtime.freshRequestWindow();
    await exerciseParents(context,fixture,peer);
    await runtime.freshRequestWindow();
    await exerciseSearch(context,fixture);
    await runtime.freshRequestWindow();
    await exerciseIssueEditorReceipts(context,fixture,peer);
    assert.deepEqual(errors,[],"new issue/view/board/search/parent journeys have no uncaught browser errors");
  } finally {
    page.off("pageerror",recordError);
    await peer.context.close();
  }
}
