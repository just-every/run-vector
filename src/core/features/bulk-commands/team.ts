import { isMutationAccessError, mutationDatabase } from "../auth/mutation-database";
import { planSelectedTeamMove } from "../team-move/plan";
import { teamSelection, type TeamSelectionRow } from "../team-move/selection";
import { bulkTeamInputSchema, type BulkTeamInput } from "./input";
import { BulkCommandError, selectedSnapshotAdmission } from "./validation";

export async function moveSelectedIssueTeams(source: D1Database, actor: string, input: BulkTeamInput) {
  input = bulkTeamInputSchema.parse(input);
  const db = mutationDatabase(source, actor);
  const validation = teamSelection(db, actor, input);
  const rows = (await validation.statement.all<TeamSelectionRow>()).results;
  const failures = validation.failures(rows);
  if (failures.length) throw new BulkCommandError(failures);
  const at = new Date().toISOString();
  const plans = rows.map((row) => planSelectedTeamMove(db, row, actor, input.teamId,
    input.issues.find((selected) => selected.identifier === row.identifier)!.statusId, at));
  try {
    await db.batch([
      validation.admission,
      selectedSnapshotAdmission(db, rows),
      ...plans.flatMap((plan) => plan.writes),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    const current = await teamSelection(db, actor, input).statement.all<TeamSelectionRow>();
    const failures = validation.failures(current.results);
    if (failures.length) throw new BulkCommandError(failures);
    throw error;
  }
  return {
    issues: rows.map((row, index) => ({ identifier: row.identifier, version: plans[index].version })),
    changed: plans.filter((plan) => plan.changed).length,
  };
}
