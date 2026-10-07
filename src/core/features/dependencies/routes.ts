import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { getIssueDetail } from "../issues/service";
import { DependencyError } from "./errors";
import { dependencyInputSchema } from "./input";
import {
  mutateDependencyRecord,
  requireDependencyPair,
  type DependencyOperation,
} from "./repository";

async function dependencyRoute(
  context: Context<AppEnvironment>,
  operation: DependencyOperation,
) {
  const identifier = context.req.param("identifier") ?? "";
  if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(identifier))
    return context.json({ error: "invalid_request" }, 400);
  const parsed = dependencyInputSchema.safeParse(
    await readRequestJson(context.req.raw),
  );
  if (!parsed.success)
    return context.json(
      { error: "invalid_request", issues: parsed.error.issues },
      400,
    );
  try {
    const actor = context.get("operatorId");
    const outcome = await mutateDependencyRecord(
      context.env.DB,
      identifier,
      actor,
      parsed.data,
      operation,
    );
    await requireDependencyPair(
      context.env.DB,
      identifier,
      parsed.data.relatedIdentifier,
      actor,
    );
    const now = new Date();
    const [issue, relatedIssue] = await Promise.all([
      getIssueDetail(context.env.DB, identifier, now),
      getIssueDetail(context.env.DB, parsed.data.relatedIdentifier, now),
    ]);
    // Private conflict DTOs and successful reads are reauthorized after async
    // projection work, including a mid-request removal/workspace change.
    await requireDependencyPair(
      context.env.DB,
      identifier,
      parsed.data.relatedIdentifier,
      actor,
    );
    if (!issue || !relatedIssue)
      throw new DependencyError(
        "issue_not_found",
        "An issue is unavailable.",
        404,
      );
    return outcome === "stale"
      ? context.json(
          {
            error: "stale_version",
            issue,
            version: issue.version,
            relatedIssue,
            relatedVersion: relatedIssue.version,
          },
          409,
        )
      : context.json({ issue, relatedIssue });
  } catch (error) {
    if (!(error instanceof DependencyError)) throw error;
    return context.json(
      { error: error.code, message: error.message },
      error.status,
    );
  }
}

export const addDependencyRoute = (context: Context<AppEnvironment>) =>
  dependencyRoute(context, "add");
export const removeDependencyRoute = (context: Context<AppEnvironment>) =>
  dependencyRoute(context, "remove");
