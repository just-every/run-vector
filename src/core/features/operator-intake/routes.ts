import { isMutationAccessError } from "../auth/mutation-database";
import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IssueMutationError } from "../issues/errors";
import { getIssueDetail } from "../issues/service";
import { operatorIntakeInputSchema } from "./input";
import { createOperatorIntake } from "./repository";

export async function createOperatorIntakeRoute(
  context: Context<AppEnvironment>,
) {
  const parsed = operatorIntakeInputSchema.safeParse(
    await readRequestJson(context.req.raw),
  );
  if (!parsed.success)
    return context.json(
      { error: "invalid_request", issues: parsed.error.issues },
      400,
    );
  try {
    const result = await createOperatorIntake(
      context.env.DB,
      context.get("operatorId"),
      parsed.data,
    );
    const issue = await getIssueDetail(
      context.env.DB,
      result.identifier,
      new Date(),
    );
    if (!issue) throw new Error("Committed intake could not be read.");
    return context.json(issue, 201);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    if (error instanceof IssueMutationError)
      return context.json(
        { error: "invalid_request", message: error.message },
        400,
      );
    console.error("Operator intake persistence failed", error);
    return context.json(
      {
        error: "intake_unavailable",
        message:
          "Intake could not be confirmed. Refresh the workspace before trying again.",
      },
      503,
    );
  }
}
