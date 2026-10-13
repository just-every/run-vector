import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { inject, expect } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { sampleOwner, sampleBindings, origin } from "./sample-auth-fixture";
import { ids } from "./bulk-parent-fixture";
export { ids, receipt } from "./bulk-parent-fixture";
const app = createServerApp();
let cookie: string;
export async function setup() {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  cookie = await sampleOwner();
}
export function call(
  path: string,
  body?: unknown,
  method = "POST",
  db = env.DB,
) {
  return app.request(
    origin + "/api" + path,
    {
      method: body === undefined ? "GET" : method,
      headers: {
        host: new URL(origin).host,
        origin,
        cookie,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...sampleBindings, DB: db },
  );
}
export async function create(extra: Record<string, unknown> = {}) {
  const response = await call("/issues", {
    title: "Mutation work",
    teamId: ids.flow,
    ...extra,
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<any>;
}
