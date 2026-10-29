import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { SearchAccessError } from "./access";
import { getSearchOptions, searchWorkspace, SearchIndexError } from "./service";

const querySchema = z.object({
  q: z.string().trim().min(1).max(1000),
  includeArchived: z.enum(["true", "false"]).default("false"),
  at: z.string().datetime({ offset: true }).optional(),
});

export function addSearchRoutes(app: Hono<AppEnvironment>) {
  for (const path of ["/search", "/options"] as const)
    app.get(path, async (context) => {
      const actor = context.get('operator');
      if (!actor || actor.id !== context.get("operatorId"))
        return context.json(
          {
            error: "unauthenticated",
            message: "Sign in again to search this workspace.",
          },
          401,
        );
      const query =
        path === "/search" ? querySchema.safeParse(context.req.query()) : null;
      if (query && !query.success)
        return context.json(
          { error: "invalid_request", issues: query.error.issues },
          400,
        );
      try {
        return context.json(
          path === "/search"
            ? await searchWorkspace(
                context.env.DB,
                actor.id,
                query!.data!.q,
                query!.data!.includeArchived === "true",
                actor.fence,
              )
            : await getSearchOptions(context.env.DB, actor.id, actor.fence),
        );
      } catch (error) {
        if (error instanceof SearchAccessError)
          return context.json(
            { error: "unauthenticated", message: error.message },
            401,
          );
        if (error instanceof SearchIndexError)
          return context.json(
            {
              error: "search_unavailable",
              message: error.message,
              lastSuccessfulIndexAt: error.lastSuccessfulIndexAt,
            },
            503,
          );
        throw error;
      }
    });
}
