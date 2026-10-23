import type { Context, Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IssueAccessError } from "../issues/access";
import { requireIssueProjection } from "../issues/projection-access";
import { changeReaction, ReactionError, readReactions } from "./repository";
import { reactionInputSchema } from "./schema";

async function projection(c: Context<AppEnvironment>) {
  c.set("concealWorkspaceChange", true);
  const issue = await requireIssueProjection(c, c.req.param().identifier);
  const result = await readReactions(c.env.DB, issue.id, c.get("operatorId"));
  await requireIssueProjection(c, issue.identifier);
  return c.json(result);
}

export function addReactionRoutes(app: Hono<AppEnvironment>) {
  app.use("/issues/:identifier/reactions", async (c, next) => {
    if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(c.req.param("identifier") ?? ""))
      return c.json({ error: "invalid_request" }, 400);
    await next();
  });
  app.get("/issues/:identifier/reactions", async (c) => {
    try { return await projection(c); }
    catch (error) { return denial(c, error); }
  });
  for (const method of ["PUT", "DELETE"] as const)
    app.on(method, "/issues/:identifier/reactions", async (c) => {
      const input = reactionInputSchema.safeParse(await readRequestJson(c.req.raw));
      if (!input.success)
        return c.json({ error: "invalid_request", issues: input.error.issues }, 400);
      try {
        await changeReaction(c.env.DB, c.req.param("identifier"), c.get("operatorId"), input.data, method === "PUT");
        // Keep the captured session through the enclosing response admission.
        c.set("mutationPageProjection", true);
        return await projection(c);
      } catch (error) { return denial(c, error); }
    });
}

async function denial(c: Context<AppEnvironment>, error: unknown) {
  if (!(error instanceof IssueAccessError || error instanceof ReactionError)) throw error;
  // A denial may reveal resource existence only to a currently admitted reader.
  if (error instanceof ReactionError) {
    try { await requireIssueProjection(c, c.req.param().identifier); }
    catch (admission) {
      if (!(admission instanceof IssueAccessError)) throw admission;
      return c.json({ error: admission.code, message: admission.message }, admission.status);
    }
  }
  return c.json({ error: error.code, message: error.message }, error.status);
}
