import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { auditBothWidths, settled } from "./ui-state-audit.mjs";
import { delayIssueReads, writingReceipt } from "./issue-editor-delayed-reads.mjs";
import { exerciseWritingReloadRace } from "./issue-editor-reload-race.mjs";

export async function exerciseIssueEditorReceipts(context, fixture, peer) {
  const { page, base } = context;
  const previous = page.viewportSize();
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await receiptJourney(context, fixture, peer, width);
    }
  } finally {
    await page.setViewportSize(previous);
  }
}

async function receiptJourney(context, fixture, peer, width) {
  const { page, base } = context;
  const { api, team, backlog } = fixture;
  const create = title => api("/api/issues", "POST", {
    teamId: team.id, statusId: backlog.id, title, description: `Original description ${width}.`,
  }, 201);
  const original = await create(`Writing receipt original ${width}`);
  const other = await create(`Writing receipt other ${width}`);
  const path = `/api/issues/${original.identifier}`;
  await page.goto(base + `/app/issues/${original.identifier}`);
  await settled(page);
  const writing = page.locator(".issue-writing-editor");
  const title = writing.locator('[name="title"]');
  const description = writing.locator('[name="description"]');
  const edit = () => writing.getByRole("button", { name: "Edit issue", exact: true }).click();
  const cancel = () => writing.getByRole("button", { name: "Cancel edit", exact: true }).click();
  const save = status => writingReceipt(page, path,
    () => writing.getByRole("button", { name: "Save changes", exact: true }).click(), status);
  // The initial effect-driven read must mount this issue before refresh reads
  // are held; otherwise the barrier can prevent the first editor from mounting.
  await page.getByRole("heading", { name: original.title, exact: true }).waitFor();
  await expect(writing.getByRole("button", { name: "Edit issue", exact: true })).toBeEnabled();
  const reads = await delayIssueReads(page, path);
  let completed = false;
  try {
    await edit();
    await title.fill(`Writing receipt first ${width}`);
    await description.fill(`First saved description ${width}.`);
    const first = await save();
    assert.equal(first.request.expectedVersion, original.version, "ISSUE-006 initial save uses last read version");
    assert.equal(first.issue.version, original.version + 1);
    assert.equal(first.issue.title, `Writing receipt first ${width}`);
    assert.equal(first.issue.description, `First saved description ${width}.`);
    await reads.wait(0, first.issue.version);
    // Reopen before the successful PATCH's parent GET can reach React.
    await edit();
    const reopenedTitle = await title.inputValue();
    const reopenedDescription = await description.inputValue();
    await title.fill(`Writing receipt second ${width}`);
    await description.fill(`Second saved description ${width}.`);
    const second = await save();
    assert.equal(reopenedTitle, first.issue.title, "ISSUE-006 immediate reopen reads PATCH title before parent refresh");
    assert.equal(reopenedDescription, first.issue.description, "ISSUE-006 immediate reopen reads PATCH description before parent refresh");
    assert.equal(second.request.expectedVersion, first.issue.version, "ISSUE-006 immediate second write uses N+1 receipt version");
    assert.equal(second.issue.version, first.issue.version + 1);
    assert.equal(second.issue.title, `Writing receipt second ${width}`);
    assert.equal(second.issue.description, `Second saved description ${width}.`);
    await edit();
    assert.equal(await title.inputValue(), second.issue.title, "ISSUE-006 second receipt reopens before the older parent read drains");
    assert.equal(await description.inputValue(), second.issue.description);
    await cancel();
    // The second commit queues its parent refresh behind this genuine N+1 GET.
    await reads.release(0);
    await reads.wait(1, second.issue.version);
    await edit();
    assert.equal(await title.inputValue(), second.issue.title, "ISSUE-006 delayed older GET cannot downgrade latest writing receipt");
    assert.equal(await description.inputValue(), second.issue.description);
    await auditBothWidths(context, `writing-${width}-receipt-after-stale-get`);
    await cancel();
    await reads.release(1);
    await page.getByRole("heading", { name: second.issue.title, exact: true }).waitFor();

    await edit();
    assert.equal(await title.inputValue(), second.issue.title, "ISSUE-006 current parent GET retains the latest writing title");
    assert.equal(await description.inputValue(), second.issue.description);
    const external = await peer.api(path, "PATCH", {
      expectedVersion: second.issue.version,
      title: `Writing receipt external ${width}`, description: `External description ${width}.`,
    });
    const draft = `Unsaved conflict draft ${width}`;
    await title.fill(draft);
    const beforeConflict = await api(path);
    const conflict = await save(409);
    assert.equal(conflict.request.expectedVersion, second.issue.version);
    assert.equal(conflict.issue.error, "stale_version", "ISSUE-006 genuine concurrent write is refused");
    assert.equal(await title.inputValue(), draft, "ISSUE-006 conflict keeps the operator draft");
    assert.equal(await description.inputValue(), second.issue.description);
    assert.deepEqual(await api(path), beforeConflict, "ISSUE-007 stale writing changes no issue fields or activity");
    await auditBothWidths(context, `writing-${width}-genuine-conflict-draft`);

    await writing.getByRole("button", { name: "Reload issue", exact: true }).click();
    await reads.wait(2, external.version);
    assert.equal(await title.inputValue(), draft, "ISSUE-006 pending explicit reload retains the draft until GET delivery");
    assert.equal(await description.inputValue(), second.issue.description);
    await reads.release(2);
    await page.waitForFunction(() => !document.querySelector(".issue-editor-controls:disabled"));
    assert.equal(await title.inputValue(), external.title, "ISSUE-006 explicit reload replaces the draft only after validated GET");
    assert.equal(await description.inputValue(), external.description);
    await reads.wait(3, external.version);
    await cancel();
    await edit();
    assert.equal(await title.inputValue(), external.title, "ISSUE-006 reload receipt survives cancel/reopen before parent refresh");
    assert.equal(await description.inputValue(), external.description);
    await auditBothWidths(context, `writing-${width}-reload-receipt-before-refresh`);
    await cancel();
    await reads.release(3);
    await page.getByRole("heading", { name: external.title, exact: true }).waitFor();

    const newer = await peer.api(path, "PATCH", {
      expectedVersion: external.version,
      title: `Writing receipt newer parent ${width}`, description: `Newer parent description ${width}.`,
    });
    // Adding a genuine comment requests parent refresh without changing version.
    await page.getByLabel("Add a comment", { exact: true }).fill(`Refresh writing evidence ${width}.`);
    const commentResponse=page.waitForResponse(response=>new URL(response.url()).pathname===path+'/comments'&&response.request().method()==='POST');
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    assert.equal((await commentResponse).status(),201,'ISSUE-006 native comment commits before requesting the parent refresh');
    await reads.wait(4, newer.version);
    await reads.release(4);
    await page.getByRole("heading", { name: newer.title, exact: true }).waitFor();
    await edit();
    assert.equal(await title.inputValue(), newer.title, "ISSUE-006 newer parent props supersede older PATCH/reload receipts");
    assert.equal(await description.inputValue(), newer.description);
    await title.fill(`Writing receipt newer saved ${width}`);
    const latest = await save();
    assert.equal(latest.request.expectedVersion, newer.version, "ISSUE-006 newer parent version is used for the next mutation");
    await reads.wait(5, latest.issue.version);
    await reads.release(5);
    await page.getByRole("heading", { name: latest.issue.title, exact: true }).waitFor();
    const afterReloadRace = await exerciseWritingReloadRace({ context, peer, path, reads, latest: latest.issue, width, title, description, writing, save, cancel, edit });
    await edit();
    await title.fill(`First issue leftover draft ${width}`);
    await peer.api(path, "PATCH", { expectedVersion: afterReloadRace.version, priority: "urgent" });
    await save(409);
    const documentMarker = `writing-receipt-${width}`;
    await page.evaluate(marker => { window.__writingReceiptDocument = marker; }, documentMarker);
    await page.getByRole("link", { name: "Issues", exact: true }).filter({ visible: true }).first().click();
    await settled(page);
    await page.getByRole("button", { name: "Reset controls", exact: true }).click();
    await settled(page);
    await page.locator(`#issue-row-${other.identifier}`).click();
    await page.getByRole("heading", { name: other.title, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__writingReceiptDocument), documentMarker, "ISSUE-006 source-to-destination uses the same client document");
    assert.equal(await writing.getByRole("alert").count(), 0, "ISSUE-006 issue identity change discards prior error");
    await edit();
    assert.equal(await title.inputValue(), other.title, "ISSUE-006 issue identity change cannot reuse another draft or receipt");
    assert.equal(await description.inputValue(), other.description);
    await auditBothWidths(context, `writing-${width}-other-issue-identity`);
    await title.fill(`Other issue saved ${width}`);
    const otherSaved = await writingReceipt(page, `/api/issues/${other.identifier}`,
      () => writing.getByRole("button", { name: "Save changes", exact: true }).click());
    assert.equal(otherSaved.request.expectedVersion, other.version, "ISSUE-006 new identity uses its own version");
    assert.equal(otherSaved.issue.identifier, other.identifier);
    assert.equal(otherSaved.issue.description, other.description);
    await settled(page);
    await auditBothWidths(context, `writing-${width}-other-issue-saved`);
    completed = true;
  } catch (error) {
    console.error("Issue writing receipt journey failed", { width, message: error.message });
    throw error;
  } finally {
    await reads.close(!completed);
  }
}
