import { env } from "cloudflare:workers";
import { it } from "vitest";
import { proveRoleUpgrade } from "./role-upgrade-proof";
// Released v0.4.1 and main before this change share migration head 0074; the store also holds 0073-0074 rows.
it("released v0.4.1 and main (0001-0074) populated store upgrades through 0075-0077", async () => proveRoleUpgrade("0075_workspace_roles.sql", async () => {
  const owner = (await env.DB.prepare("SELECT id,workspace_id FROM operators ORDER BY created_at LIMIT 1").first<{ id: string; workspace_id: string }>())!;
  await env.DB.prepare("INSERT INTO vector_slack_member_links(operator_id,workspace_id,slack_team_id,slack_user_id,slack_name,dm_kinds,linked_at) VALUES(?,?,?,?,?,?,?)")
    .bind(owner.id, owner.workspace_id, "T-synthetic-vector-1", "U-synthetic-vector-1", "synthetic-vector-1", JSON.stringify(["assignment"]), new Date().toISOString()).run();
}), 180000);
