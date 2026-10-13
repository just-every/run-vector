import { restoredEffectsHeld } from '../data/restore-authority';
import { requireIssueAccess } from '../issues/access';
import { mutationDatabase } from "../auth/mutation-database";
import { IssueMutationError } from "../issues/errors";
import {
  clearDeferral,
  dueIntake,
  findIntake,
  guardReturnedNoop,
} from "./repository";

export async function returnDueIntake(
  env: { DB: D1Database },
  now = new Date(),
) {
  const at = now.toISOString();
  const result = { processed: 0, returned: 0, skipped: 0 };
  if (await restoredEffectsHeld(env.DB)) return result;
  for (const issue of await dueIntake(env.DB, at)) {
    const changed = await clearDeferral(
      env.DB,
      issue,
      null,
      "Deferral return automation",
      at,
      true,
    );
    result.processed++;
    if (changed) result.returned++;
    else result.skipped++;
  }
  return result;
}

export async function endIntakeDeferral(
  db: D1Database,
  identifier: string,
  actor: string,
  expectedVersion: number,
  now = new Date(),
): Promise<"written" | "stale"> {
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1 ||
    !Number.isFinite(now.getTime())
  )
    throw new IssueMutationError(
      "invalid_option",
      "A valid issue version and return time are required.",
    );
  const noopDb = db;
  db = mutationDatabase(db, actor);
  const issue = await findIntake(db, identifier);
  if (!issue)
    throw new IssueMutationError(
      "issue_not_found",
      `Issue ${identifier} was not found.`,
    );
  await requireIssueAccess(db,identifier,actor);
  if (issue.version !== expectedVersion) return "stale";
  if (issue.category !== "intake")
    throw new IssueMutationError(
      "invalid_transition",
      `Issue ${identifier} is not awaiting an intake decision.`,
    );
  const changed =
    issue.deferred_until === null
      ? await guardReturnedNoop(noopDb, issue, actor)
      : await clearDeferral(db, issue, actor, null, now.toISOString(), false);
  return changed ? "written" : "stale";
}
