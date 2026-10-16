import { requireIssueAccess } from '../issues/access';
import { mutationDatabase } from "../auth/mutation-database";
import { IssueMutationError } from "../issues/errors";
import {
  clearDeferral,
  dueIntake,
  findIntake,
  guardReturnedNoop,
  type DeferredIntake,
} from "./repository";

export async function returnDueIntake(
  env: { DB: D1Database },
  now = new Date(),
) {
  return returnIntakeCandidates(env.DB, await dueIntake(env.DB, now.toISOString()), now);
}

/** Apply freshly selected candidates through the same guarded event transaction. */
export async function returnIntakeCandidates(
  db: D1Database,
  candidates: readonly DeferredIntake[],
  now: Date,
) {
  const at = now.toISOString();
  const result = { processed: 0, returned: 0, skipped: 0 };
  // Candidate selection checks the restore hold in its own SQL snapshot;
  // clearDeferral repeats that fence before committing any automatic effects.
  for (const issue of candidates) {
    const changed = await clearDeferral(
      db,
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
