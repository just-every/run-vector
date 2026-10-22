import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { actor, invite, request } from "./base-auth-fixture";

let workspaces = 0;
/** The people of the role-matrix journey (ROLE-001): an Owner, an Admin, a
 * Member who owns the team, a Member who does not and a Guest in that team.
 * No door assigns Guest before ROLE-003, so the harness sets that role on an
 * invited member's record. */
export async function roleWorkspace() {
  const f = await setupAdministration();
  // Cases in one file share a database: each gets its own people and team.
  const run = String.fromCharCode(65 + workspaces++);
  const team = (await f.mutate("/settings/teams", "POST", { name: `Roles ${run}`, identifierPrefix: `ROLE${run}` })).teams.find((t) => t.name === `Roles ${run}`)!;
  const person = async (name: string, role?: "admin") => {
    const cookie = await invite(`${name}-${run.toLowerCase()}@roles.test`, f.cookie, role);
    return { cookie, id: await actor(cookie) };
  };
  const admin = await person("admin", "admin"),
    lead = await person("lead"),
    member = await person("member"),
    guest = await person("guest");
  await env.DB.prepare("UPDATE operators SET role='guest' WHERE id=?").bind(guest.id).run();
  for (const [who, role] of [[lead, "owner"], [member, "member"], [guest, "member"]] as const)
    expect((await f.call(`/settings/teams/${team.id}/members/${who.id}`, "PUT", { role })).status).toBe(200);
  const as = (who: { cookie: string }) => (path: string, method = "GET", body?: unknown) =>
    request("/api" + path, method, body, who.cookie);
  return { ...f, team, admin, lead, member, guest, as };
}

/** Every row a refused request could have touched, to prove it changed nothing. */
export async function snapshot(tables: string[]) {
  return Object.fromEntries(await Promise.all(tables.map(async (name) =>
    [name, (await env.DB.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()).results] as const)));
}
