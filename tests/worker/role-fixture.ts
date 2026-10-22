import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { actor, invite, request } from "./base-auth-fixture";

/** The people of the role-matrix journey (ROLE-001): an Owner, an Admin, a
 * Member who owns the team, a Member who does not and a Guest in that team.
 * No door assigns Guest before ROLE-003, so the harness sets that role on an
 * invited member's record. */
export async function roleWorkspace() {
  const f = await setupAdministration();
  const team = f.initial.teams[0];
  const person = async (email: string, role?: "admin") => {
    const cookie = await invite(email, f.cookie, role);
    return { cookie, id: await actor(cookie) };
  };
  const admin = await person("admin@roles.test", "admin"),
    lead = await person("lead@roles.test"),
    member = await person("member@roles.test"),
    guest = await person("guest@roles.test");
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
