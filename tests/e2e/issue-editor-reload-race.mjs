import assert from "node:assert/strict";
import { auditBothWidths } from "./ui-state-audit.mjs";

// A reload fetched before a later parent read must not replace that newer
// record. Both snapshots come from the real Worker and are delivered unchanged.
export async function exerciseWritingReloadRace({ context, peer, path, reads, latest, width, title, description, writing, save, cancel, edit }) {
  const { page } = context;
  await edit();
  const competitor = await peer.api(path, "PATCH", { expectedVersion: latest.version, priority: "low" });
  await title.fill(`Reload race retained draft ${width}`);
  await save(409);
  await writing.getByRole("button", { name: "Reload issue", exact: true }).click();
  await reads.wait(6, competitor.version);
  const newer = await peer.api(path, "PATCH", {
    expectedVersion: competitor.version, title: `Newer during explicit reload ${width}`,
    description: `Newer description during explicit reload ${width}.`,
  });
  await page.getByLabel("Add a comment", { exact: true }).fill(`Refresh while writing reload is held ${width}.`);
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await reads.wait(7, newer.version);
  await reads.release(7);
  await page.getByRole("heading", { name: newer.title, exact: true }).waitFor();
  await reads.release(6);
  await page.waitForFunction(() => !document.querySelector(".issue-editor-controls:disabled"));
  assert.equal(await title.inputValue(), newer.title, "ISSUE-006 old explicit reload cannot roll back newer parent title");
  assert.equal(await description.inputValue(), newer.description, "ISSUE-006 old explicit reload cannot roll back newer parent description");
  await reads.wait(8, newer.version);
  await auditBothWidths(context, `writing-${width}-reload-cannot-rollback-newer-props`);
  await cancel();
  await edit();
  assert.equal(await title.inputValue(), newer.title);
  await title.fill(`Reload race saved newest ${width}`);
  const saved = await save();
  assert.equal(saved.request.expectedVersion, newer.version, "ISSUE-006 explicit reload retains the newest version for subsequent writes");
  // The saved receipt queues a refresh; let the admitted older GET drain first.
  await reads.release(8);
  await reads.wait(9, saved.issue.version);
  await reads.release(9);
  await page.getByRole("heading", { name: saved.issue.title, exact: true }).waitFor();
  return saved.issue;
}
