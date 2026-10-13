import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import assert from "node:assert/strict";
import { inject } from "vitest";
import { createApiApp } from "../../src/core/app/api";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";

const app = createApiApp(), origin = "https://vector.test";
let cookie: string;
export async function setup() {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date());
  cookie = await testCookie(env.DB, ids.sarah);
}
export function request(path: string, method: string, body?: unknown, db = env.DB) {
  return app.request(origin + path, {
    method,
    headers: { cookie, origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, { ...env, DB: db, APP_ORIGIN: origin });
}
export async function createIssue(values: Record<string, unknown> = {}) {
  const response = await request("/issues", "POST", {
    teamId: ids.flow, title: "Receipt fixture", ...values,
  });
  assert.equal(response.status, 201);
  return await response.json() as { id: string; identifier: string; version: number };
}
export async function state(id: string) {
  return {
    issue: await env.DB.prepare("SELECT * FROM issues WHERE id=?").bind(id).first(),
    activity: (await env.DB.prepare("SELECT * FROM issue_activity WHERE issue_id=? ORDER BY id").bind(id).all()).results,
    comments: (await env.DB.prepare("SELECT * FROM issue_comments WHERE issue_id=? ORDER BY id").bind(id).all()).results,
    audit: (await env.DB.prepare("SELECT * FROM audit_records WHERE subject_identifier=(SELECT identifier FROM issues WHERE id=?) ORDER BY id").bind(id).all()).results,
  };
}
export async function matches(id: string, text: string) {
  const rows = await env.DB.prepare("SELECT i.id FROM search_issues JOIN issues i ON i.id=search_issues.id WHERE search_issues MATCH ? AND i.id=?").bind(text, id).all();
  return rows.results.length === 1;
}

// Observe real D1 receipts and optionally schedule a competing committed write.
// Every statement and receipt still comes from the native database.
export function observeBatch(before?: () => Promise<void>) {
  const receipts: D1Result<Record<string, unknown>>[] = [];
  let ran = false;
  const db = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch") return async (statements: D1PreparedStatement[]) => {
        if (!ran && before) { ran = true; await before(); }
        const result = await target.batch<Record<string, unknown>>(statements);
        receipts.push(...result);
        return result;
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db, receipts };
}
export function assertIndexedReceipt(receipts: D1Result<Record<string, unknown>>[], id: string) {
  assert.ok(receipts.some(receipt => receipt.results.length === 1 &&
    receipt.results[0].id === id && receipt.meta.changes > 1),
  "direct row identity is returned even though FTS triggers increase total changes");
}
