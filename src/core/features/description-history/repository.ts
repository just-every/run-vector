import { requireIssueAccess } from "../issues/access";
import { updateIssueRecord } from "../issue-edit/repository";
import { DescriptionMutationError } from "./errors";
import { parseTasks, toggleTask } from "./tasks";
import type { ChecklistInput, DescriptionRestoreInput } from "./schema";

export async function readDescriptionHistory(db: D1Database, identifier: string, actor: string) {
  const issue = await requireIssueAccess(db, identifier, actor);
  const revisions = (await db.prepare(`SELECT r.id,r.description,COALESCE(r.actor_name,o.name) actor,r.created_at createdAt,r.version
    FROM issue_description_revisions r LEFT JOIN operators o ON o.id=r.actor_operator_id
    WHERE r.issue_id=? ORDER BY r.created_at,r.rowid`).bind(issue.id).all<{
      id: string; description: string; actor: string | null; createdAt: string; version: number | null;
    }>()).results;
  await requireIssueAccess(db, identifier, actor);
  return { revisions };
}

export async function restoreDescription(db: D1Database, identifier: string, actor: string, input: DescriptionRestoreInput) {
  const issue = await requireIssueAccess(db, identifier, actor);
  const revision = await db.prepare("SELECT description FROM issue_description_revisions WHERE id=? AND issue_id=?")
    .bind(input.revisionId, issue.id).first<{ description: string }>();
  if (!revision) throw new DescriptionMutationError("not_found", 404, "Description revision is unavailable.");
  return updateIssueRecord(db, identifier, actor, {
    expectedVersion: input.expectedVersion, description: revision.description,
  }, { descriptionRestore: { revisionId: input.revisionId } });
}

export async function tickDescriptionTask(db: D1Database, identifier: string, actor: string, input: ChecklistInput) {
  const issue = await requireIssueAccess(db, identifier, actor);
  const current = await db.prepare("SELECT description,version FROM issues WHERE id=?")
    .bind(issue.id).first<{ description: string; version: number }>();
  if (!current || input.expectedVersion > current.version) return "stale" as const;
  if (input.expectedVersion !== current.version) {
    const base = await db.prepare(`SELECT description FROM issue_description_revisions
      WHERE issue_id=? AND version<=? ORDER BY version DESC,created_at DESC,rowid DESC LIMIT 1`)
      .bind(issue.id, input.expectedVersion).first<{ description: string }>();
    if (!base || parseTasks(base.description)[input.index]?.text !== input.text) return "stale" as const;
  }
  const description = toggleTask(current.description, input.index, input.text, input.checked);
  if (description === null) return "stale" as const;
  // The normal version guard still fences a concurrent change after this read.
  return updateIssueRecord(db, identifier, actor, {
    expectedVersion: current.version, description,
  }, { checklist: { index: input.index, text: input.text, checked: input.checked } });
}
