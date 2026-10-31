import { responsibleOperator, triageResponsibilitySchema } from "../administration/triage-responsibility";
import { returnIntakeCandidates } from "../intake-return/service";
import { loadCurrentWorkspaceSnapshot, loadWorkspaceSnapshot } from "./repository";
import { projectCurrent, projectMyWork } from "./projection";
import type { WorkspaceProjection } from './snapshot';

export async function getCurrentStream(binding: D1Database, now: Date, workspace?: WorkspaceProjection) {
  // Caller-controlled as-of read time must never make a future deferral return.
  const returnTime = new Date();
  const captured = await loadCurrentWorkspaceSnapshot(binding, returnTime.toISOString());
  let snapshot = captured.snapshot;
  if (captured.candidates.length) {
    await returnIntakeCandidates(binding, captured.candidates, returnTime);
    snapshot = await loadWorkspaceSnapshot(binding);
  }
  if (workspace) workspace.snapshot = snapshot;
  const intakeStatuses = new Set(
    snapshot.statuses
      .filter((status) => status.category === "intake")
      .map((status) => status.id),
  );
  // Keep the full graph for dependency and project evaluation; hide only the
  // future deferrals using real time, even for a caller-supplied future as-of.
  // Expired rows remain visible while bounded automation drains the receipts.
  const pending = new Set(
    snapshot.issues
      .filter(
        (issue) =>
          intakeStatuses.has(issue.statusId) && issue.deferredUntil !== null &&
          new Date(issue.deferredUntil) > returnTime,
      )
      .map((issue) => issue.id),
  );
  const projection = projectCurrent(snapshot, now);
  projection.sections["needs-decision"] = projection.sections[
    "needs-decision"
  ].filter((issue) => !pending.has(issue.id));
  const memberships=await binding.prepare("SELECT team_id,operator_id FROM team_members WHERE team_id IN(SELECT value FROM json_each(?))").bind(JSON.stringify(snapshot.teams.map(team=>team.id))).all<{team_id:string;operator_id:string}>();
  const triageAssignments=snapshot.teams.filter(team=>team.triageEnabled && team.triageResponsibilityJson).map(team=>{
    const config=triageResponsibilitySchema.parse(JSON.parse(team.triageResponsibilityJson!));
    const responsibleId=responsibleOperator(config,snapshot.workspace?.timezone ?? 'UTC',now);
    const person=snapshot.operators.find(person=>person.id===responsibleId && person.removedAt===null && ['owner','admin','member'].includes(person.role));
    return {teamId:team.id,teamName:team.name,responsibleId:person && memberships.results.some(member=>member.team_id===team.id && member.operator_id===responsibleId) ? responsibleId : null,pending:projection.sections['needs-decision'].filter(issue=>issue.team.id===team.id).map(issue=>issue.identifier)};
  });
  return {...projection,triageAssignments};
}

export async function getMyWorkStream(
  binding: D1Database,
  operatorId: string,
  now: Date,
  projection?: WorkspaceProjection,
) {
  const snapshot = await loadWorkspaceSnapshot(binding);
  if (projection) projection.snapshot = snapshot;
  return projectMyWork(snapshot, operatorId, now);
}

export { loadWorkspaceSnapshot };
