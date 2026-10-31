import { estimateChoices, estimateScaleSchema } from "./estimate-scale";
import { IssueMutationError } from "../issues/errors";

/** Native writes re-read team configuration; archives retain numeric history. */
export async function admitEstimate(db: D1Database, teamId: string, value: number | null) {
  const team = await db.prepare("SELECT estimates_enabled,estimate_scale FROM teams WHERE id=?").bind(teamId)
    .first<{estimates_enabled:number;estimate_scale:string}>();
  if (!team || !team.estimates_enabled) throw new IssueMutationError("invalid_option", "Enable estimates in team Settings before changing an estimate.");
  const scale=estimateScaleSchema.parse(team.estimate_scale);
  if (value !== null && !estimateChoices(scale).some(choice=>choice.value===value))
    throw new IssueMutationError("invalid_option", "Choose an estimate from this team's scale.");
  return team;
}
