import type { Context } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { requireOperator } from "../auth/service";
import { nativeSessionAdmission } from "../auth/projection-admission";
import { browseActor } from "../issues/browse-access";
import { IssueAccessError } from "../issues/access";
import { ViewError } from "./repository";
/** Capture the admitted session before work and recheck it in the final SQL snapshot. */
export const handle =
  (run: (c: Context<AppEnvironment>) => Promise<Response>) =>
  async (c: Context<AppEnvironment>) => {
    try {
      const admitted = c.get('operator');
      if (!admitted || admitted.id !== c.get("operatorId"))
        return c.json({ error: "unauthenticated" }, 401);
      const workspace = c.get('documentProjection') ? admitted.workspaceId : (await browseActor(c.env.DB, admitted.id)).workspace_id;
      const response = await run(c);
      const payload = (await response.clone().json()) as {
        id?: string;
        views?: { id: string }[];
      };
      const viewIds =
        payload.views?.map((view) => view.id) ??
        (payload.id ? [payload.id] : []);
      const current = c.get('documentProjection') ? admitted : await requireOperator(c.env, c.req.raw);
      if (
        !current ||
        current.id !== admitted.id ||
        JSON.stringify(current.fence) !== JSON.stringify(admitted.fence)
      )
        return c.json({ error: "unauthenticated" }, 401);
      const session = nativeSessionAdmission(admitted.fence);
      const final = await c.env.DB.prepare(
        `SELECT actor.removed_at,actor.workspace_id,
        ${session.sql} AS session_admitted,
        (SELECT count(*) FROM saved_views v WHERE v.id IN (SELECT value FROM json_each(?))
          AND v.workspace_id=actor.workspace_id AND (v.owner_operator_id=actor.id OR v.is_shared=1)) AS visible
        FROM operators actor WHERE actor.id=?`,
      )
        .bind(...session.values, JSON.stringify(viewIds), admitted.id)
        .first<{
          removed_at: string | null;
          workspace_id: string;
          session_admitted: number;
          visible: number;
        }>();
      if (
        !final ||
        final.removed_at !== null ||
        final.workspace_id !== workspace ||
        !final.session_admitted
      )
        return c.json({ error: "unauthenticated" }, 401);
      if (final.visible !== viewIds.length)
        return c.json({ error: "not_found" }, 404);
      return response;
    } catch (error) {
      if (error instanceof ViewError || error instanceof IssueAccessError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      if (error instanceof z.ZodError)
        return c.json({ error: "invalid_request", issues: error.issues }, 400);
      throw error;
    }
  };
