import type { Context } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { IssueAccessError } from "../issues/access";

/** Keep access denials private without obscuring storage or programming errors. */
export function discussionAccess(
  handler: (context: Context<AppEnvironment>) => Promise<Response>,
) {
  return async (context: Context<AppEnvironment>) => {
    try {
      return await handler(context);
    } catch (error) {
      if (!(error instanceof IssueAccessError)) throw error;
      return context.json(
        { error: error.code, message: error.message },
        error.status,
      );
    }
  };
}
