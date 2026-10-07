import { mutationDatabase } from "../auth/mutation-database";
import { drizzle } from "drizzle-orm/d1";
import {
  activityRow,
  requireIssue,
  requireStatus,
  validateAssignee,
  validateProject,
  validateCycle,
  validateLabels,
} from "../issues/repository";
import { IssueMutationError } from "../issues/errors";
import type { UpdateIssueInput } from "./routes";

const columns = {
  title: "title",
  description: "description",
  priority: "priority",
  assigneeOperatorId: "assignee_operator_id",
  statusId: "status_id",
  projectId: "project_id",
  cycleId: "cycle_id",
  estimate: "estimate",
  dueDate: "due_date",
  expectedOutcome: "expected_outcome",
  customerImpact: "customer_impact",
  completedAt: "completed_at",
  canceledAt: "canceled_at",
  customFields: "custom_fields_json",
} as const;

// JSON object order and label order do not constitute product changes.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ":" +
            canonical((value as Record<string, unknown>)[key]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}

export async function updateIssueRecord(
  binding: D1Database,
  identifier: string,
  actor: string,
  input: UpdateIssueInput,
) {
  const noopBinding = binding;
  binding = mutationDatabase(binding, actor);
  const db = drizzle(binding),
    issue = await requireIssue(db, identifier),
    now = new Date().toISOString();
  if (issue.version !== input.expectedVersion) return "stale" as const;
  const values: Record<string, unknown> = {},
    previous: Record<string, unknown> = {};
  for (const key of [
    "title",
    "description",
    "priority",
    "assigneeOperatorId",
    "statusId",
    "projectId",
    "cycleId",
    "estimate",
    "dueDate",
    "expectedOutcome",
    "customerImpact",
  ] as const) {
    if (input[key] !== undefined && input[key] !== issue[key]) {
      values[key] = input[key];
      previous[key] = issue[key];
    }
  }
  if (input.customFields !== undefined) {
    const old = JSON.parse(issue.customFieldsJson);
    if (canonical(input.customFields) !== canonical(old)) {
      values.customFields = input.customFields;
      previous.customFields = old;
    }
  }
  const oldLabels = (
    await binding
      .prepare(
        "SELECT label_id FROM issue_labels WHERE issue_id=? ORDER BY label_id",
      )
      .bind(issue.id)
      .all<{ label_id: string }>()
  ).results.map((row) => row.label_id);
  const nextLabels = input.labelIds?.slice().sort();
  const labelsChanged =
    nextLabels !== undefined && canonical(nextLabels) !== canonical(oldLabels);
  if (labelsChanged) {
    previous.labelIds = oldLabels;
    values.labelIds = nextLabels;
  }

  // The same predicate guards every statement; the version changes last. An
  // option becoming unavailable after validation makes the entire batch a no-op.
  const conditions = ["issues.id=?", "issues.version=?", "EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL)"],
    guardValues: (string | number)[] = [issue.id, input.expectedVersion, actor];
  const guard = (condition: string, ...args: (string | number)[]) => {
    conditions.push(condition);
    guardValues.push(...args);
  };
  const team = await binding
    .prepare("SELECT workspace_id FROM teams WHERE id=?")
    .bind(issue.teamId)
    .first<{ workspace_id: string }>();
  if (!team) throw new Error("Issue team is missing.");
  if ("assigneeOperatorId" in values && values.assigneeOperatorId !== null) {
    await validateAssignee(db, String(values.assigneeOperatorId));
    const operator = await binding
      .prepare("SELECT workspace_id FROM operators WHERE id=?")
      .bind(String(values.assigneeOperatorId))
      .first<{ workspace_id: string }>();
    if (operator?.workspace_id !== team.workspace_id)
      throw new IssueMutationError(
        "invalid_option",
        "Assignee is unavailable in this workspace.",
      );
    guard(
      "EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)",
      String(values.assigneeOperatorId),
      team.workspace_id,
    );
  }
  if ("projectId" in values && values.projectId !== null) {
    await validateProject(db, String(values.projectId), team.workspace_id);
    guard(
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND workspace_id=? AND archived_at IS NULL)",
      String(values.projectId),
      team.workspace_id,
    );
  }
  if ("statusId" in values) {
    const current = await requireStatus(db, issue.statusId, issue.teamId),
      next = await requireStatus(db, String(values.statusId), issue.teamId);
    if (
      ["intake", "duplicate"].includes(current.category) ||
      !["backlog", "unstarted", "started", "completed", "canceled"].includes(
        next.category,
      )
    )
      throw new IssueMutationError(
        "invalid_transition",
        "Use an intake or duplicate decision for this transition.",
      );
    values.completedAt = next.category === "completed" ? now : null;
    values.canceledAt = next.category === "canceled" ? now : null;
    guard(
      "EXISTS(SELECT 1 FROM workflow_statuses WHERE id=? AND team_id=? AND category=?)",
      next.id,
      issue.teamId,
      next.category,
    );
    guard(
      "EXISTS(SELECT 1 FROM workflow_statuses WHERE id=issues.status_id AND category NOT IN ('intake','duplicate'))",
    );
  }
  if ("cycleId" in values && values.cycleId !== null) {
    await validateCycle(db, String(values.cycleId), issue.teamId);
    const status = await requireStatus(
      db,
      String(values.statusId ?? issue.statusId),
      issue.teamId,
    );
    if (["completed", "canceled", "duplicate"].includes(status.category))
      throw new IssueMutationError(
        "invalid_option",
        "Terminal work cannot be assigned to a cycle.",
      );
    guard(
      "EXISTS(SELECT 1 FROM cycles WHERE id=? AND team_id=? AND closed_at IS NULL)",
      String(values.cycleId),
      issue.teamId,
    );
    guard(
      "EXISTS(SELECT 1 FROM workflow_statuses WHERE id=? AND team_id=? AND category NOT IN ('completed','canceled','duplicate'))",
      status.id,
      issue.teamId,
    );
  }
  if (labelsChanged) {
    // Retained historical selections need not pass today's workspace rules.
    const added = nextLabels.filter((id) => !oldLabels.includes(id));
    await validateLabels(db, added, team.workspace_id);
    for (const label of added)
      guard(
        "EXISTS(SELECT 1 FROM labels WHERE id=? AND workspace_id=?)",
        label,
        team.workspace_id,
      );
    for (const label of nextLabels)
      guard("EXISTS(SELECT 1 FROM labels WHERE id=?)", label);
  }
  const where = conditions.join(" AND ");
  if (Object.keys(values).length === 0) {
    const result = await noopBinding
      .prepare(`UPDATE issues SET version=version WHERE ${where}`)
      .bind(...guardValues)
      .run();
    return result.meta.changes === 1
      ? ("written" as const)
      : ("stale" as const);
  }
  const activity = activityRow({
    issueId: issue.id,
    actorOperatorId: actor,
    kind: "issue.updated",
    previousValue: previous,
    nextValue: values,
    now,
  });
  const writes = [
    binding
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
    SELECT ?,issues.id,?,'issue.updated',?,?,?,? FROM issues WHERE ${where}`,
      )
      .bind(
        activity.id,
        actor,
        activity.previousValueJson,
        activity.nextValueJson,
        now,
        now,
        ...guardValues,
      ),
  ];
  if (labelsChanged) {
    writes.push(
      binding
        .prepare(
          `DELETE FROM issue_labels WHERE issue_id=? AND EXISTS(SELECT 1 FROM issues WHERE ${where})`,
        )
        .bind(issue.id, ...guardValues),
    );
    for (const label of nextLabels)
      writes.push(
        binding
          .prepare(
            `INSERT INTO issue_labels(issue_id,label_id,created_at) SELECT issues.id,?,? FROM issues WHERE ${where}`,
          )
          .bind(label, now, ...guardValues),
      );
  }
  const fields = Object.keys(values).filter(
    (key): key is keyof typeof columns => key in columns,
  );
  writes.push(
    binding
      .prepare(
        `UPDATE issues SET ${[...fields.map((key) => columns[key] + "=?"), "version=version+1", "updated_at=?"].join(",")} WHERE ${where}`,
      )
      .bind(
        ...fields.map((key) =>
          key === "customFields"
            ? JSON.stringify(values[key])
            : (values[key] as string | number | null),
        ),
        now,
        ...guardValues,
      ),
  );
  const results = await binding.batch(writes);
  if (results.at(-1)!.meta.changes === 1) return "written" as const;
  const current = await requireIssue(db, identifier);
  if (current.version !== input.expectedVersion) return "stale" as const;
  throw new IssueMutationError(
    "invalid_option",
    "A selected option became unavailable. Refresh and choose again.",
  );
}
