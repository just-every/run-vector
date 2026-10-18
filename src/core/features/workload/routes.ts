import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { SettingsError } from "../settings/repository";
import { workloadQuerySchema, capacityInputSchema } from "./schema";
import { readWorkload, setCapacity } from "./service";
export function addWorkloadRoutes(app: Hono<AppEnvironment>) {
  app.on(["GET", "PUT"], "/workload", async (c) => {
    const query = workloadQuerySchema.safeParse(c.req.query());
    if (!query.success)
      return c.json(
        {
          error: "invalid_request",
          message: "Choose a cycle or an ordered due-date range.",
        },
        400,
      );
    try {
      if (c.req.method === "PUT") {
        const input = capacityInputSchema.safeParse(
          await readRequestJson(c.req.raw),
        );
        if (!input.success)
          return c.json(
            {
              error: "invalid_request",
              message: "Capacity must be whole points or empty.",
            },
            400,
          );
        await setCapacity(
          c.env.DB,
          c.get("operatorId"),
          query.data,
          input.data,
        );
      }
      return c.json(
        await readWorkload(c.env.DB, c.get("operatorId"), query.data),
      );
    } catch (error) {
      if (error instanceof SettingsError)
        return c.json(
          { error: error.code, message: error.message },
          error.status,
        );
      throw error;
    }
  });
}
