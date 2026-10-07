import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  cycles,
  evidenceRevisions,
  intakeDecisions,
  issueActivity,
  issueDependencies,
  issueLabels,
  issues,
  labels,
  listPreferences,
  operators,
  operatorSessions,
  projects,
  savedViews,
  teamIssueSequences,
  teams,
  workflowStatuses,
  workspaceSettings,
} from "../../platform/db/schema";
import type { SampleData } from "./schema";

export async function insertSampleData(
  binding: D1Database,
  data: SampleData,
): Promise<void> {
  const db = drizzle(binding);
  await db
    .insert(workspaceSettings)
    .values(data.workspace)
    .onConflictDoNothing();
  await db.insert(operators).values(data.operators).onConflictDoNothing();
  await db.insert(operatorSessions).values(data.sessions).onConflictDoNothing();
  await db.insert(teams).values(data.teams).onConflictDoNothing();
  await db
    .insert(workflowStatuses)
    .values(data.workflowStatuses)
    .onConflictDoNothing();
  await db.insert(projects).values(data.projects).onConflictDoNothing();
  await db.insert(cycles).values(data.cycles).onConflictDoNothing();
  await db.insert(labels).values(data.labels).onConflictDoNothing();
  for (const issue of data.issues) {
    await db.insert(issues).values(issue).onConflictDoNothing();
  }
  const highestSequenceByTeam = new Map<string, number>();
  for (const issue of data.issues) {
    highestSequenceByTeam.set(
      issue.teamId,
      Math.max(
        highestSequenceByTeam.get(issue.teamId) ?? 0,
        issue.sequenceNumber,
      ),
    );
  }
  for (const [teamId, lastSequence] of highestSequenceByTeam) {
    await db
      .insert(teamIssueSequences)
      .values({ teamId, lastSequence, updatedAt: data.workspace.updatedAt })
      .onConflictDoUpdate({
        target: teamIssueSequences.teamId,
        // A cold local Worker may repeat bootstrap. Leave retained allocation
        // receipts untouched unless the imported sample actually raises the floor.
        setWhere: sql`${teamIssueSequences.lastSequence} < excluded.last_sequence`,
        set: {
          lastSequence: sql`MAX(${teamIssueSequences.lastSequence}, excluded.last_sequence)`,
          updatedAt: data.workspace.updatedAt,
        },
      });
  }
  await db.insert(issueLabels).values(data.issueLabels).onConflictDoNothing();
  await db
    .insert(issueDependencies)
    .values(data.dependencies)
    .onConflictDoNothing();
  await db
    .insert(evidenceRevisions)
    .values(data.evidence)
    .onConflictDoNothing();
  await db.insert(intakeDecisions).values(data.decisions).onConflictDoNothing();
  await db.insert(issueActivity).values(data.activity).onConflictDoNothing();
  await db.insert(savedViews).values(data.savedViews).onConflictDoNothing();
  await db
    .insert(listPreferences)
    .values(data.listPreferences)
    .onConflictDoNothing();
}
