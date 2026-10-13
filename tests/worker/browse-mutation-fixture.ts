import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { request } from "./search-mutation-receipts-fixture";

export { ids };
export type Issue = { id: string; identifier: string; version: number };
export async function intake() {
  const response = await request("/intake", "POST", {
    title: "Browsing revision intake", teamId: ids.flow,
  });
  assert.equal(response.status, 201);
  return await response.json() as Issue;
}
export const decisionBody = (kind: string, expectedVersion = 1) => ({
  expectedVersion,
  ...(kind === "accept" ? { assigneeOperatorId: ids.maya } : {}),
  ...(kind === "defer" ? {
    returnAt: new Date(Date.now() + 86400000).toISOString(), reason: "Await evidence",
  } : {}),
  ...(kind === "decline" ? { reason: "Already addressed" } : {}),
});
export async function revision() {
  return (await env.DB.prepare("SELECT revision FROM issue_list_revision WHERE id=1")
    .first<{ revision: number }>())!.revision;
}
export async function history(id: string) {
  const rows: Record<string, unknown> = {};
  for (const table of ["issue_activity", "intake_decisions", "issue_deferral_origins"])
    rows[table] = (await env.DB.prepare(`SELECT * FROM ${table} WHERE issue_id=? ORDER BY rowid`)
      .bind(id).all()).results;
  return rows;
}
export async function retained() {
  const rows: Record<string, unknown> = {};
  for (const table of [
    "issues", "issue_activity", "intake_decisions", "issue_deferral_origins",
    "issue_dependencies", "workspace_settings", "issue_list_revision",
    "issue_followers", "notifications", "notification_deliveries",
  ]) rows[table] = (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
  return rows;
}
export function assertDirectReceipt(
  receipts: D1Result<Record<string, unknown>>[], key: "id" | "identifier", identity: string,
) {
  const matches = receipts.filter(result => result.results.length === 1 && result.results[0][key] === identity);
  assert.equal(matches.length, 1, "one guarded mutation returns the exact native row");
  assert.equal(matches[0].meta.changes, 2, "the native row and browsing trigger both wrote");
}
