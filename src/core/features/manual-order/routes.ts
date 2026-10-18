import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { handle } from "../views/route-handler";
import { manualOrderScopeSchema, moveManualOrderSchema } from "./schema";
import { ManualOrderError, moveManualOrder, readManualOrder } from "./service";

/** Register before /issues/:identifier so "order" is never treated as an issue. */
export function addManualOrderRoutes(app: Hono<AppEnvironment>) {
  app.get(
    "/issues/order",
    handle(async (c) => {
      try {
        return c.json(
          await readManualOrder(
            c.env.DB,
            c.get("operatorId"),
            manualOrderScopeSchema.parse(c.req.query()),
          ),
        );
      } catch (error) {
        if (error instanceof ManualOrderError)
          return c.json(
            { error: error.code, message: error.message },
            error.status,
          );
        throw error;
      }
    }),
  );
  app.post(
    "/issues/order",
    handle(async (c) => {
      try {
        const result = await moveManualOrder(
          c.env.DB,
          c.get("operatorId"),
          moveManualOrderSchema.parse(await readRequestJson(c.req.raw)),
        );
        return result.stale
          ? c.json({ error: "stale_version", version: result.version }, 409)
          : c.json({ version: result.version });
      } catch (error) {
        if (error instanceof ManualOrderError)
          return c.json(
            { error: error.code, message: error.message },
            error.status,
          );
        throw error;
      }
    }),
  );
}
