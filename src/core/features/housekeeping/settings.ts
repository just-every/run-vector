import { createUlid } from "../../shared/ids";
import { administrationContext, audit, commit, ownedRow, SettingsError } from "../administration/transaction";
import { candidates } from "./candidates";
import type { Housekeeping } from "./schema";

async function activeTeam(db: D1Database, actor: string, teamId: string) {
  const ctx = await administrationContext(db, actor);
  const team = await ownedRow<{ archived_at: string | null }>(ctx, "teams", teamId);
  if (team.archived_at)
    throw new SettingsError("team_archived", "Unarchive the team before changing its automation.", 409);
  return ctx;
}

export async function saveHousekeeping(db: D1Database, actor: string, teamId: string, input: Housekeeping) {
  const ctx = await activeTeam(db, actor, teamId);
  const previous = await ctx.db.prepare("SELECT * FROM team_housekeeping WHERE team_id=?").bind(teamId).first();
  await commit(ctx, [
    ctx.db
      .prepare(
        `INSERT INTO team_housekeeping(team_id,close_after_days,archive_after_days,exempt_bugs,revision,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(team_id) DO UPDATE SET close_after_days=excluded.close_after_days,archive_after_days=excluded.archive_after_days,
          exempt_bugs=excluded.exempt_bugs,revision=excluded.revision,updated_at=excluded.updated_at`,
      )
      .bind(teamId, input.closeAfterDays, input.archiveAfterDays, input.exemptBugs ? 1 : 0, createUlid(new Date(ctx.at)), ctx.at),
    ...audit(ctx, "team.housekeeping.updated", teamId, teamId, previous, input),
  ]);
}

/** What the next scheduled run would close and archive under these (unsaved) periods. */
export async function previewHousekeeping(db: D1Database, actor: string, teamId: string, input: Housekeeping) {
  const ctx = await activeTeam(db, actor, teamId);
  return candidates(ctx.db, { ...input, teamId }, ctx.at);
}
