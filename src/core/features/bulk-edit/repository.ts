import { commitUndoable, prepareUndoCapture, UndoCaptureConflict } from "../issue-undo/capture";
import {
  isMutationAccessError,
  mutationDatabase,
} from "../auth/mutation-database";
import { IssueAccessError } from "../issues/access";
import { IssueMutationError } from "../issues/errors";
import { planIssueUpdate } from "../issue-edit/plan";
import { bulkIssueInputSchema, type BulkIssueInput } from "./input";
import { bulkFailures, bulkValidation, type BulkFailure } from "./validation";
export class BulkIssueError extends Error {
  constructor(readonly failures: BulkFailure[]) {
    super("No issues were changed. Resolve the reported issues and try again.");
  }
}
export async function bulkUpdateIssues(
  source: D1Database,
  actor: string,
  input: BulkIssueInput,
) {
  input = bulkIssueInputSchema.parse(input);
  const db = mutationDatabase(source, actor);
  const failures = await bulkFailures(db, actor, input);
  if (failures.length) throw new BulkIssueError(failures);
  const planned = await Promise.all(
    input.issues.map(async (selected) => {
      try {
        return {
          selected,
          plan: await planIssueUpdate(
            db,
            selected.identifier,
            actor,
            { ...input.changes, expectedVersion: selected.expectedVersion },
            true,
          ),
        };
      } catch (error) {
        if (
          error instanceof IssueMutationError ||
          error instanceof IssueAccessError
        )
          return { selected, error: error.message };
        throw error;
      }
    }),
  );
  const planningFailures = planned.flatMap((row) =>
    row.error || !row.plan
      ? [
          {
            identifier: row.selected.identifier,
            reasons: [row.error ?? "The issue version is stale."],
          },
        ]
      : [],
  );
  if (planningFailures.length) {
    const current = await bulkFailures(db, actor, input);
    throw new BulkIssueError([
      ...current,
      ...planningFailures.filter(
        (row) => !current.some((other) => other.identifier === row.identifier),
      ),
    ]);
  }
  const plans = planned.map((row) => row.plan!);
  const capture = await prepareUndoCapture(db, actor, {
    actionId: plans[0].activityId, identifiers: plans.map((plan) => plan.identifier),
    fields: [...new Set(plans.flatMap((plan) => plan.undoFields))], kind: "property",
  });
  try {
    // Admission runs before ANY activity, follower, notification or issue write.
    // D1 holds this snapshot through the complete batch transaction.
    await commitUndoable(db, actor, capture, [
      bulkValidation(db, actor, input).admission,
      ...plans.map((plan) =>
        db
          .prepare(
            `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues WHERE ${plan.where}) THEN 1 ELSE json('bulk plan changed') END`,
          )
          .bind(...plan.guardValues),
      ),
      ...plans.flatMap((plan) => plan.writes),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    const current = await bulkFailures(db, actor, input);
    if (current.length) throw new BulkIssueError(current);
    if (error instanceof UndoCaptureConflict) throw new BulkIssueError(error.failures);
    throw error;
  }
  return {
    issues: plans.map((plan) => ({
      identifier: plan.identifier,
      version: plan.version,
    })),
    changed: plans.length,
  };
}
