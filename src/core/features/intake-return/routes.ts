import type { Context } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IssueMutationError } from "../issues/errors";
import { getIssueDetail } from "../issues/service";
import { endIntakeDeferral } from "./service";

const inputSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
const identifierPattern = /^[A-Z]{2,10}-[1-9][0-9]*$/;

export async function returnIntakeRoute(context: Context<AppEnvironment>) {
  const identifier = context.req.param("identifier") ?? "";
  if (!identifierPattern.test(identifier))
    return context.json(
      { error: "invalid_request", message: "Invalid issue identifier." },
      400,
    );
  const parsed = inputSchema.safeParse(await readRequestJson(context.req.raw));
  if (!parsed.success)
    return context.json(
      { error: "invalid_request", issues: parsed.error.issues },
      400,
    );
  try {
    const now = new Date();
    const outcome = await endIntakeDeferral(
      context.env.DB,
      identifier,
      context.get("operatorId"),
      parsed.data.expectedVersion,
      now,
    );
    const issue = await getIssueDetail(context.env.DB, identifier, now);
    if (!issue) return context.json({ error: "not_found" }, 404);
    return outcome === "stale"
      ? context.json(
          { error: "stale_version", issue, version: issue.version },
          409,
        )
      : context.json(issue, 200);
  } catch (error) {
    if (!(error instanceof IssueMutationError)) throw error;
    return context.json(
      {
        error:
          error.code === "issue_not_found" ? "not_found" : "invalid_request",
        message: error.message,
      },
      error.code === "issue_not_found"
        ? 404
        : error.code === "invalid_transition"
          ? 409
          : 400,
    );
  }
}
