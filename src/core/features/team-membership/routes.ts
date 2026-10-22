import type { Context, Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { readAdministration } from "../administration/read";
import { administrationId } from "../administration/schema";
import { SettingsError } from "../administration/transaction";
import { joinTeam, leaveTeam, removeTeamMember, setTeamMember } from "./service";
import { setTeamPermissions } from "./permissions";

const memberRole = z.object({ role: z.enum(["owner", "member"]) }).strict();
const permission = z.enum(["team_owners", "all_members"]);
const permissions = z.object({ settings: permission, planning: permission }).strict();

/** ROLE-007 and ROLE-009 doors: the directory's Join and Leave, a team's
 * member list and its two permissions. */
export function addTeamMembershipRoutes(app: Hono<AppEnvironment>) {
  const act = (run: (c: Context<AppEnvironment>) => Promise<unknown>) => async (c: Context<AppEnvironment>) => {
    if (Object.values(c.req.param()).some((id) => !administrationId.safeParse(id).success))
      return c.json({ error: "invalid_request" }, 400);
    try {
      await run(c);
      return c.json(await readAdministration(c.env.DB, c.get("operatorId")));
    } catch (error) {
      if (error instanceof SettingsError) return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  };
  app.post("/teams/:teamId/join", act((c) => joinTeam(c.env.DB, c.get("operatorId"), c.req.param("teamId")!)));
  app.post("/teams/:teamId/leave", act((c) => leaveTeam(c.env.DB, c.get("operatorId"), c.req.param("teamId")!)));
  app.put("/settings/teams/:id/members/:operatorId", act(async (c) => {
    const input = memberRole.safeParse(await readRequestJson(c.req.raw));
    if (!input.success) throw new SettingsError("invalid_request", "Choose Owner or Member for the team role.", 400);
    await setTeamMember(c.env.DB, c.get("operatorId"), c.req.param("id")!, c.req.param("operatorId")!, input.data.role);
  }));
  app.delete("/settings/teams/:id/members/:operatorId", act((c) =>
    removeTeamMember(c.env.DB, c.get("operatorId"), c.req.param("id")!, c.req.param("operatorId")!)));
  app.put("/settings/teams/:id/permissions", act(async (c) => {
    const input = permissions.safeParse(await readRequestJson(c.req.raw));
    if (!input.success) throw new SettingsError("invalid_request", "Choose Team owners only or All team members for each permission.", 400);
    await setTeamPermissions(c.env.DB, c.get("operatorId"), c.req.param("id")!, input.data);
  }));
}
