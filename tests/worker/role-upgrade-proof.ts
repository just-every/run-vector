import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { sha256 } from "../../vendor/base/integrations/core/crypto";
import { createServerApp } from "../../src/core/app/server";
import { provePopulatedUpgrade } from "./populated-upgrade";
import { sampleBindings } from "./sample-auth-fixture";

// One-off evidence for migrations 0075-0077: a populated store at an earlier
// shape keeps every row, every operator becomes an Owner, the installation
// owner owns every team, and its sessions, API tokens and pending links work.
export async function proveRoleUpgrade(boundary: string, extra: () => Promise<void> = async () => {}) {
  const token = "int_" + "5e".repeat(32);
  let planted = { owner: "", workspace: "" };
  await provePopulatedUpgrade(boundary, undefined, ["operators", "teams", "oa_sessions", "integration_tokens", "oa_tokens"], async () => {
    const owner = (await env.DB.prepare("SELECT id,workspace_id FROM operators WHERE lower(email)=?").bind(sampleBindings.FIRST_OWNER_EMAIL).first<{ id: string; workspace_id: string }>())!;
    planted = { owner: owner.id, workspace: owner.workspace_id };
    const issuer = (await env.DB.prepare("SELECT a.id,a.version FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=?").bind(owner.id).first<{ id: string; version: number }>())!;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO integration_tokens(namespace,id,token_hash,name,scopes,created_at) VALUES(?,?,?,?,?,?)")
        .bind(`vector:${owner.workspace_id}:${owner.id}`, "pre-roles-token", await sha256(token), "Pre-roles token", JSON.stringify(["issues:read", "issues:write"]), Date.now()),
      env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('pre-roles-invitee','pending@upgrade.test','Pending','owner','invited',1,?)").bind(Date.now()),
      env.DB.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at) VALUES('pre-roles-invite','pre-roles-invite-hash','invite','pre-roles-invitee',1,?,?,'/app',?,?)")
        .bind(issuer.id, issuer.version, Date.now(), Date.now() + 86400000),
    ]);
    await extra();
  });
  const value = async (sql: string) => (await env.DB.prepare(sql).all()).results;
  expect(await value("SELECT count(*) AS n FROM operators WHERE role<>'owner'")).toEqual([{ n: 0 }]);
  const installation = (await env.DB.prepare("SELECT setup_operator_id AS id FROM workspace_installation").first<{ id: string }>())!.id;
  expect(await value(`SELECT count(*) AS n FROM teams t WHERE NOT EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.operator_id='${installation}' AND m.role='owner')`)).toEqual([{ n: 0 }]);
  expect(await value("SELECT count(*) AS n FROM team_members")).toEqual(await value("SELECT count(*) AS n FROM teams"));
  expect(await value("SELECT DISTINCT settings_permission AS settings,planning_permission AS planning FROM teams")).toEqual([{ settings: "team_owners", planning: "all_members" }]);
  expect(await value("SELECT token_id AS token,role FROM vector_invitation_roles")).toEqual([{ token: "pre-roles-invite", role: "owner" }]);
  const app = createServerApp(), call = (path: string, method = "GET", body?: unknown) => app.request(sampleBindings.APP_ORIGIN + "/api/v1" + path, {
    method, headers: { Authorization: "Bearer " + token, "content-type": "application/json", host: new URL(sampleBindings.APP_ORIGIN).host },
    body: body === undefined ? undefined : JSON.stringify(body) }, sampleBindings);
  expect((await call("/issues")).status).toBe(200);
  const team = (await env.DB.prepare("SELECT id FROM teams WHERE workspace_id=? AND archived_at IS NULL LIMIT 1").bind(planted.workspace).first<{ id: string }>())!.id;
  const created = await call("/issues", "POST", { title: "Written by a pre-roles token", teamId: team });
  expect(created.status, await created.clone().text()).toBe(201);
}
