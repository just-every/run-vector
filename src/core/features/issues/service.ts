import {issueSpecificationStatement,type SpecificationRow} from '../documents/projection';
import { referenceSourceVisible } from "../issue-references/projection";
import { relatedIssuesStatement } from '../related/repository';
import { parseTasks } from "../description-history/tasks";
import { publicActivityValue } from '../issue-undo/public-activity';
import { duplicateRelationsStatement, duplicateRelationsProjection, type DuplicateRelationRow } from '../duplicates/repository';
import { importedFromStatement, importedFromProjection, type ImportedFromRow } from '../data/import/issue-source';
import { evidenceChanges,type EvidenceChange } from '../integrations/evidence-changes';
import { parentRelationsStatement, parentRelationsProjection, type ParentRelationRow } from "../parents/projection";
import { evidenceMetadataStatement, type EvidenceMetadata } from "../operator-intake/repository";
import { categoryByStatus, projectHealthForIssue } from "../projects";
import { loadWorkspaceSnapshot, type WorkspaceSnapshot } from "../streams";

export async function getIssueDetail(
  binding: D1Database,
  identifier: string,
  now: Date,
  workspace?: WorkspaceSnapshot,
) {
  const detail = buildIssueDetail(
    workspace ?? await loadWorkspaceSnapshot(binding),
    identifier,
    now,
  );
  if (!detail) return null;
  const rows = await Promise.all(issueDetailReadStatements(binding, detail.id).map(statement => statement.all()));
  return enrichIssueDetail(detail, rows);
}

export function issueDetailReadStatements(binding: D1Database, issueId: string) {
  return [
    evidenceMetadataStatement(binding, issueId),
    binding
      .prepare(
        "SELECT id,actor_name FROM issue_activity WHERE issue_id=? AND actor_name IS NOT NULL",
      )
      .bind(issueId),
    parentRelationsStatement(binding, issueId),
    duplicateRelationsStatement(binding, issueId),
    importedFromStatement(binding, issueId),
    relatedIssuesStatement(binding, issueId),
    issueSpecificationStatement(binding, issueId),
  ] as const;
}

export function enrichIssueDetail(
  detail: NonNullable<ReturnType<typeof buildIssueDetail>>,
  [metadataResult, actorResult, parentResult, duplicateResult, provenanceResult, relatedResult, specificationResult]: readonly D1Result[],
) {
  const metadataRows = metadataResult.results as EvidenceMetadata[];
  const actorRows = actorResult.results as Array<{ id: string; actor_name: string }>;
  const parents = parentRelationsProjection(parentResult.results as ParentRelationRow[]);
  const duplicates = duplicateRelationsProjection(duplicateResult.results as DuplicateRelationRow[]);
  const provenance = importedFromProjection(provenanceResult.results[0] as ImportedFromRow | undefined);
  const metadata = new Map(
    metadataRows.map((row) => [row.id, row]),
  );
  const evidence = detail.evidence.map((row) => {
    const meta = metadata.get(row.id);
    if (!meta) throw new Error(`Evidence ${row.id} has no metadata`);
    return {
      ...row,
      originKind: meta.origin_kind,
      sourceId:meta.source_id,sourceRecordId:meta.source_record_id,sourceRevisionId:meta.source_revision_id,
      actor: meta.actor,
      link: meta.link,
      customerReports: parsePersistedJson(
        meta.customer_reports_json,
        `evidence ${row.id} customer reports`,
      ) as Array<{ customer?: string; summary: string; link: string | null }>,
    };
  });
  const previous=new Map<string,typeof evidence[number]>();
  for(const revision of evidence){if(revision.sourceId&&revision.sourceRecordId){const key=revision.sourceId+':'+revision.sourceRecordId;revision.changes=evidenceChanges(revision,previous.get(key));previous.set(key,revision);}}
  const actors = new Map(
    actorRows.map((row) => [row.id, row.actor_name]),
  );
  const activity = detail.activity.map((row) => ({
    ...row,
    actor: actors.get(row.id) ?? row.actor,
  }));
  return { ...detail, specification:(specificationResult.results[0] as SpecificationRow|undefined)??null, dependencies: [...detail.dependencies, ...(relatedResult.results as {identifier:string;title:string}[]).map(row=>({...row,direction:'related'}))], evidence, activity, ...parents, ...duplicates, importedFrom: provenance };
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
        left.receivedAt.localeCompare(right.receivedAt) || left.id.localeCompare(right.id),
    )
    .map((item) => ({
      id: item.id,
      sourceName: item.sourceName,
      sourceId:null as string|null,sourceRecordId:null as string|null,sourceRevisionId:null as string|null,changes:[] as EvidenceChange[],
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
  const visibleIssueIds = new Set(snapshot.issues.map(item => item.id));
  const activity = snapshot.activity
    .filter((item) => item.issueId === issue.id)
    .filter((item) => referenceSourceVisible(item, visibleIssueIds))
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
          : publicActivityValue(parsePersistedJson(
              item.nextValueJson,
              `activity ${item.id} next value`,
            )),
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
  const milestone = issue.milestoneId === null ? null : snapshot.projectMilestones.find(item => item.id === issue.milestoneId);
  if (issue.milestoneId !== null && (!milestone || milestone.projectId !== issue.projectId))
    throw new Error(`Issue ${identifier} references a missing or incompatible milestone`);
  const cycle =
    issue.cycleId === null
      ? null
      : (snapshot.cycles.find((item) => item.id === issue.cycleId) ?? null);
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    checklist: { completed: parseTasks(issue.description).filter(task => task.checked).length, total: parseTasks(issue.description).length },
    status: { id: status.id, name: status.name, category: status.category },
    priority: issue.priority,
    startDate: issue.startDate,
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
    milestoneId: issue.milestoneId,
    milestone: milestone ? { id: milestone.id, name: milestone.name, projectId: milestone.projectId } : null,
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
    archivedAt: issue.archivedAt,
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
