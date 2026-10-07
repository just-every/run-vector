import { returnDueIntake } from "../intake-return/service";
import { loadWorkspaceSnapshot } from "./repository";
import { projectCurrent, projectMyWork } from "./projection";

export async function getCurrentStream(binding: D1Database, now: Date) {
  // Caller-controlled as-of read time must never make a future deferral return.
  await returnDueIntake({ DB: binding }, new Date());
  const snapshot = await loadWorkspaceSnapshot(binding);
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
) {
  return projectMyWork(await loadWorkspaceSnapshot(binding), operatorId, now);
}

export { loadWorkspaceSnapshot };
