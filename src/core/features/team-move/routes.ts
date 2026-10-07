import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { getIssueDetail } from "../issues/service";
import { TeamMoveError } from "./errors";
import { moveIssueTeamInputSchema } from "./input";
import { moveIssueTeamRecord, requireTeamMoveIssue } from "./repository";

export async function moveIssueTeamRoute(context: Context<AppEnvironment>) {
  const identifier = context.req.param("identifier") ?? "";
  if (!/^[A-Z]{2,10}-[1-9][0-9]*$/.test(identifier))
    return context.json({ error: "invalid_request" }, 400);
  const parsed = moveIssueTeamInputSchema.safeParse(
    await readRequestJson(context.req.raw),
  );
  if (!parsed.success)
    return context.json(
      { error: "invalid_request", issues: parsed.error.issues },
      400,
    );
  try {
    const actor = context.get("operatorId");
    const outcome = await moveIssueTeamRecord(
      context.env.DB,
      identifier,
      actor,
      parsed.data,
    );
    await requireTeamMoveIssue(context.env.DB, identifier, actor);
    const issue = await getIssueDetail(context.env.DB, identifier, new Date());
    return outcome === "stale"
      ? context.json(
          { error: "stale_version", issue, version: issue?.version },
          409,
        )
      : context.json(issue);
  } catch (error) {
    if (!(error instanceof TeamMoveError)) throw error;
    return context.json(
      { error: error.code, message: error.message },
      error.status,
    );
  }
}
