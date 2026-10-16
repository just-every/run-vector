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
  // projected rows until their durable return transaction cleared deferral.
  const pending = new Set(
    snapshot.issues
      .filter(
        (issue) =>
          intakeStatuses.has(issue.statusId) && issue.deferredUntil !== null,
      )
      .map((issue) => issue.id),
  );
  const projection = projectCurrent(snapshot, now);
  projection.sections["needs-decision"] = projection.sections[
    "needs-decision"
  ].filter((issue) => !pending.has(issue.id));
  return projection;
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
