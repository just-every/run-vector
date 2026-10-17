import { drizzle } from "drizzle-orm/d1";
import { mutationDatabase } from "../auth/mutation-database";
import { requireIssue } from "../issues/repository";
import { IssueMutationError } from "../issues/errors";
import { planIssueUpdate, type IssueUpdateMetadata } from "./plan";
import type { UpdateIssueInput } from "./routes";

export async function updateIssueRecord(
  binding: D1Database,
  identifier: string,
  actor: string,
  input: UpdateIssueInput,
  metadata?: IssueUpdateMetadata,
) {
  const db = mutationDatabase(binding, actor);
  const plan = await planIssueUpdate(db, identifier, actor, input, Boolean(metadata && "descriptionRestore" in metadata), metadata);
  if (!plan) return "stale" as const;
  if (!plan.changed) {
    const result = await binding
      .prepare(`UPDATE issues SET version=version WHERE ${plan.where} RETURNING identifier`)
      .bind(...plan.guardValues)
      .run<{ identifier: string }>();
    // Revision triggers also write on a matched semantic no-op.
    return result.results.length === 1 && result.results[0].identifier === identifier
      ? ("written" as const)
      : ("stale" as const);
  }
  const results = await db.batch(plan.writes);
  if (results[plan.mutationIndex].results.length === 1)
    return "written" as const;
  const current = await requireIssue(drizzle(db), identifier);
  if (current.version !== input.expectedVersion) return "stale" as const;
  throw new IssueMutationError(
    "invalid_option",
    "A selected option became unavailable. Refresh and choose again.",
  );
}
