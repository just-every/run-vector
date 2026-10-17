import { isMutationAccessError, mutationDatabase } from "../auth/mutation-database";
import { duplicateSelection, type DuplicateSelectionRow } from "../duplicates/selection";
import { planSelectedDuplicate } from "../duplicates/selected-plan";
import { bulkDuplicateInputSchema, type BulkDuplicateInput } from "./input";
import { BulkCommandError, selectedSnapshotAdmission } from "./validation";

export async function decideSelectedDuplicates(source: D1Database, actor: string, input: BulkDuplicateInput) {
  input = bulkDuplicateInputSchema.parse(input);
  const db = mutationDatabase(source, actor);
  const validation = duplicateSelection(db, actor, input);
  const rows = (await validation.statement.all<DuplicateSelectionRow>()).results;
  const failures = validation.failures(rows);
  if (failures.length) throw new BulkCommandError(failures);
  const at = new Date().toISOString();
  const selectedIds = rows.map((row) => row.id), encoded = JSON.stringify(selectedIds);
  const plans = rows.map((row) => planSelectedDuplicate(db, row, actor, input.canonicalIdentifier, selectedIds, at));
  const relations = [db.prepare("DELETE FROM issue_duplicates WHERE issue_id IN(SELECT value FROM json_each(?))").bind(encoded)];
  if (input.canonicalIdentifier !== null) {
    relations.push(
      db.prepare("UPDATE issue_duplicates SET canonical_issue_id=? WHERE canonical_issue_id IN(SELECT value FROM json_each(?))")
        .bind(rows[0].target_id, encoded),
      db.prepare(`INSERT INTO issue_duplicates(issue_id,canonical_issue_id,created_at)
        SELECT value,?,? FROM json_each(?)`).bind(rows[0].target_id, at, encoded),
    );
  }
  try {
    await db.batch([
      validation.admission,
      selectedSnapshotAdmission(db, rows),
      ...plans.flatMap((plan) => plan.capture),
      ...plans.flatMap((plan) => plan.cascadeWrites),
      ...plans.flatMap((plan) => plan.sourceWrites),
      ...relations,
      ...plans.flatMap((plan) => plan.finalize),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    const current = await duplicateSelection(db, actor, input).statement.all<DuplicateSelectionRow>();
    const failures = validation.failures(current.results);
    if (failures.length) throw new BulkCommandError(failures);
    throw error;
  }
  return {
    issues: rows.map((row) => ({ identifier: row.identifier, version: row.version + 1 })),
    changed: rows.length,
  };
}
