import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { inject, expect } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";
export const ids = vectorSampleIds;
const app = createServerApp(),
  origin = "https://vector.test";
export async function setup() {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
}
export async function call(
  path: string,
  body?: unknown,
  method = "POST",
  db = env.DB,
  actor = ids.sarah,
) {
  return app.request(
    origin + "/api" + path,
    {
      method: body === undefined ? "GET" : method,
      headers: {
        origin,
        "content-type": "application/json",
        cookie: await testCookie(env.DB, actor),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { ...env, DB: db, APP_ORIGIN: origin },
  );
}
export async function create(extra: Record<string, unknown> = {}) {
  const response = await call("/issues", {
    title: "Mutation work",
    teamId: ids.flow,
    ...extra,
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return response.json() as Promise<any>;
}
export async function receipt() {
  const tables = [
    "issues",
    "issue_labels",
    "issue_activity",
    "notifications",
    "notification_deliveries",
    "notification_events",
    "notification_candidates",
    "issue_followers",
  ];
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [
        table,
        (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())
          .results,
      ]),
    ),
  );
}
export function select(...rows: { identifier: string; version: number }[]) {
  return rows.map((row) => ({
    identifier: row.identifier,
    expectedVersion: row.version,
  }));
}
