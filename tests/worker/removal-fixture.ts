import { env } from "cloudflare:workers";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { createServerApp } from "../../src/core/app/server";
import { createUlid } from "../../src/core/shared/ids";
import { testCookie } from "./native-fixture";
import { expect } from "vitest";

export const origin = "https://vector.test";
export const config = {
  FIRST_OWNER_EMAIL: "owner@removal.test",
  FIRST_OWNER_NAME: "Owner",
  WORKSPACE_NAME: "Removal tests",
  WORKSPACE_TIMEZONE: "UTC",
  DEFAULT_TEAM_NAME: "Engineering",
  DEFAULT_TEAM_PREFIX: "ENG",
};
export const bindings = {
  ...env,
  ...config,
  APP_ORIGIN: origin,
  SEED_SAMPLE_DATA: "false",
  MAIL_MODE: "local-outbox",
};
export const app = createServerApp();
export async function fixture() {
  await bootstrapWorkspace(env.DB, config);
  const owner = (await env.DB.prepare(
    "SELECT id,workspace_id FROM operators WHERE email=?",
  )
    .bind(config.FIRST_OWNER_EMAIL)
    .first<{ id: string; workspace_id: string }>())!;
  const team = (await env.DB.prepare("SELECT id FROM teams").first<{
    id: string;
  }>())!.id;
  const member = createUlid(new Date());
  const at = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  )
    .bind(
      member,
      owner.workspace_id,
      "Member",
      member + "@removal.test",
      at,
      at,
    )
    .run();
  const ownerCookie = await testCookie(env.DB, owner.id);
  const memberCookie = await testCookie(env.DB, member);
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = ownerCookie,
    extraBindings = bindings,
  ) =>
    app.request(
      origin + "/api" + path,
      {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      extraBindings,
    );
  const created = await request("/issues", "POST", {
    title: "Retained issue",
    teamId: team,
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as {
    id: string;
    identifier: string;
    version: number;
  };
  const remove = () => request("/settings/operators/" + member, "DELETE");
  return {
    owner: owner.id,
    workspace: owner.workspace_id,
    team,
    member,
    ownerCookie,
    memberCookie,
    issue,
    request,
    remove,
  };
}
export async function retainedData() {
  const tables = [
    "issues",
    "issue_activity",
    "issue_comments",
    "issue_links",
    "issue_files",
    "intake_decisions",
    "evidence_revisions",
    "issue_dependencies",
    "issue_labels",
    "audit_records",
    "projects",
    "project_activity",
    "saved_views",
    "workspace_settings",
  ];
  const data: Record<string, unknown> = {};
  for (const table of tables)
    data[table] = (
      await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()
    ).results;
  return data;
}
/** Backpressure guarantees the server has called read(), after native admission. */
export function heldBody() {
  let release!: (value: string) => void;
  let admitted!: () => void;
  const reading = new Promise<void>((resolve) => (admitted = resolve));
  const content = new Promise<string>((resolve) => (release = resolve));
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        admitted();
        controller.enqueue(new TextEncoder().encode(await content));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  return { body, reading, release };
}
