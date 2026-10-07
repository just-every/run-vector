import { evidenceMetadata } from "../operator-intake/repository";
import { categoryByStatus, projectHealthForIssue } from "../projects";
import { loadWorkspaceSnapshot, type WorkspaceSnapshot } from "../streams";

export async function getIssueDetail(
  binding: D1Database,
  identifier: string,
  now: Date,
) {
  const detail = buildIssueDetail(
    await loadWorkspaceSnapshot(binding),
    identifier,
    now,
  );
  if (!detail) return null;
  const metadata = new Map(
    (await evidenceMetadata(binding, detail.id)).map((row) => [row.id, row]),
  );
  detail.evidence = detail.evidence.map((row) => {
    const meta = metadata.get(row.id);
    if (!meta) throw new Error(`Evidence ${row.id} has no metadata`);
    return {
      ...row,
      originKind: meta.origin_kind,
      actor: meta.actor,
      link: meta.link,
      customerReports: parsePersistedJson(
        meta.customer_reports_json,
        `evidence ${row.id} customer reports`,
      ) as Array<{ customer?: string; summary: string; link: string | null }>,
    };
  });
  const actors = new Map(
    (
      await binding
        .prepare(
          "SELECT id,actor_name FROM issue_activity WHERE issue_id=? AND actor_name IS NOT NULL",
        )
        .bind(detail.id)
        .all<{ id: string; actor_name: string }>()
    ).results.map((row) => [row.id, row.actor_name]),
  );
  detail.activity = detail.activity.map((row) => ({
    ...row,
    actor: actors.get(row.id) ?? row.actor,
  }));
  return detail;
}

export function buildIssueDetail(
  snapshot: WorkspaceSnapshot,
  identifier: string,
  now: Date,
) {
  const issue = snapshot.issues.find((item) => item.identifier === identifier);
  if (!issue) return null;
  const status = snapshot.statuses.find((item) => item.id === issue.statusId);
  const team = snapshot.teams.find((item) => item.id === issue.teamId);
  if (!status || !team)
    throw new Error(`Issue ${identifier} has incomplete workflow data`);
  const labels = snapshot.issueLabels
    .filter((entry) => entry.issueId === issue.id)
    .map((entry) => {
      const label = snapshot.labels.find((item) => item.id === entry.labelId);
      if (!label)
        throw new Error(`Issue ${identifier} references a missing label`);
      return label;
    })
    .map((label) => ({ id: label.id, name: label.name, color: label.color }));
  const linkedIssues = snapshot.dependencies.flatMap((dependency) => {
    if (
      dependency.blockedIssueId !== issue.id &&
      dependency.blockingIssueId !== issue.id
    )
      return [];
    const relatedId =
      dependency.blockedIssueId === issue.id
        ? dependency.blockingIssueId
        : dependency.blockedIssueId;
    const related = snapshot.issues.find((item) => item.id === relatedId);
    if (!related)
      throw new Error(
        `Issue ${identifier} has a dependency on a missing issue`,
      );
    return [
      {
        direction:
          dependency.blockedIssueId === issue.id ? "blocked-by" : "blocks",
        identifier: related.identifier,
        title: related.title,
      },
    ];
  });
  const evidence = snapshot.evidence
    .filter((item) => item.issueId === issue.id)
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.receivedAt.localeCompare(right.receivedAt),
    )
    .map((item) => ({
      id: item.id,
      sourceName: item.sourceName,
      originKind: "source" as "source" | "operator",
      actor: null as string | null,
      link: null as string | null,
      customerReports: [] as Array<{
        customer?: string;
        summary: string;
        link: string | null;
      }>,
      observedAt: item.observedAt,
      receivedAt: item.receivedAt,
      summary: item.summary,
      measurements: parsePersistedJson(
        item.measurementsJson,
        `evidence ${item.id} measurements`,
      ),
      assertions: parsePersistedJson(
        item.assertionsJson,
        `evidence ${item.id} assertions`,
      ),
    }));
  const activity = snapshot.activity
    .filter((item) => item.issueId === issue.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      at: item.createdAt,
      actor: activityActor(snapshot, item.actorOperatorId, item.id),
      previousValue:
        item.previousValueJson === null
          ? null
          : parsePersistedJson(
              item.previousValueJson,
              `activity ${item.id} previous value`,
            ),
      nextValue:
        item.nextValueJson === null
          ? null
          : parsePersistedJson(
              item.nextValueJson,
              `activity ${item.id} next value`,
            ),
    }));
  const decisions = snapshot.decisions
    .filter((item) => item.issueId === issue.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      reason: item.reason,
      returnAt: item.returnAt,
      at: item.createdAt,
      actor:
        snapshot.operators.find(
          (operator) => operator.id === item.actorOperatorId,
        )?.name ?? null,
    }));
  const assignee =
    issue.assigneeOperatorId === null
      ? null
      : (snapshot.operators.find(
          (operator) => operator.id === issue.assigneeOperatorId,
        ) ?? null);
  const project =
    issue.projectId === null
      ? null
      : (snapshot.projects.find((item) => item.id === issue.projectId) ?? null);
  const cycle =
    issue.cycleId === null
      ? null
      : (snapshot.cycles.find((item) => item.id === issue.cycleId) ?? null);
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    status: { id: status.id, name: status.name, category: status.category },
    priority: issue.priority,
    dueDate: issue.dueDate,
    estimate: issue.estimate,
    version: issue.version,
    expectedOutcome: issue.expectedOutcome,
    customerImpact: issue.customerImpact,
    customFields: parsePersistedJson(
      issue.customFieldsJson,
      `issue ${identifier} custom fields`,
    ),
    team: {
      id: team.id,
      name: team.name,
      identifierPrefix: team.identifierPrefix,
    },
    assignee: assignee && { id: assignee.id, name: assignee.name },
    project: project && {
      id: project.id,
      name: project.name,
      health: projectHealthForIssue(snapshot, project.id, now),
    },
    cycle: cycle && {
      id: cycle.id,
      name: cycle.name,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
    },
    labels,
    dependencies: linkedIssues,
    evidence,
    decisions,
    activity,
    category: categoryByStatus(snapshot).get(issue.statusId),
    deferredUntil: issue.deferredUntil,
    completedAt: issue.completedAt,
    canceledAt: issue.canceledAt,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function activityActor(
  snapshot: WorkspaceSnapshot,
  operatorId: string | null,
  activityId: string,
): string | null {
  if (operatorId === null) return null;
  const operator = snapshot.operators.find((item) => item.id === operatorId);
  if (!operator)
    throw new Error(`Activity ${activityId} references a missing operator`);
  return operator.name;
}

function parsePersistedJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
}
