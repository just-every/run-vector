import {aliasTargetSql} from '../data/aliases/identity';
import { visibleTeam } from "../roles/visibility-sql";
import { extractIssueIdentifiers } from "./identifiers.server";
import type { IssueReference } from "./schema";

type ReferenceEvent = { id: string; issueId: string; actor: string; at: string };
type Subject = { kind: "description" | "comment"; id: string };

/** Append AFTER the subject write inside its existing guarded D1 batch. The
 * event receipt and exact stored body fence stale or unsuccessful commands.
 * Triggers own the one retained activity per source/target, across subjects. */
export function issueReferenceStatements(db: D1Database, event: ReferenceEvent, body: string | null, subject: Subject = { kind: "description", id: event.issueId }): D1PreparedStatement[] {
  const receipt = `EXISTS(SELECT 1 FROM issue_activity WHERE id=? AND issue_id=? AND actor_operator_id=?)`;
  const statements = [db.prepare(`DELETE FROM issue_reference_subjects
    WHERE source_issue_id=? AND subject_kind=? AND subject_id=? AND ${receipt}`)
    .bind(event.issueId, subject.kind, subject.id, event.id, event.issueId, event.actor)];
  if (body === null) return statements;
  const identifiers = extractIssueIdentifiers(body);
  if (!identifiers.length) return statements;
  const stored = subject.kind === "description"
    ? `source.description=? AND source.id=?`
    : `EXISTS(SELECT 1 FROM issue_comments c WHERE c.issue_id=source.id AND c.id=? AND c.body=? AND c.deleted_at IS NULL)`;
  const storedValues = subject.kind === "description" ? [body, subject.id] : [subject.id, body];
  statements.push(db.prepare(`INSERT INTO issue_reference_subjects(source_issue_id,target_issue_id,subject_kind,subject_id,created_at)
    SELECT source.id,target.id,?,?,? FROM issues source JOIN teams st ON st.id=source.team_id
    JOIN operators actor ON actor.workspace_id=st.workspace_id AND actor.id=? AND actor.removed_at IS NULL
    JOIN teams tt ON tt.workspace_id=st.workspace_id JOIN issues target ON target.team_id=tt.id
    WHERE source.id=? AND target.id<>source.id AND target.id IN(SELECT ${aliasTargetSql('actor.workspace_id','keys.value')} FROM json_each(?) keys)
    AND ${visibleTeam('actor', 'source.team_id')} AND ${visibleTeam('actor', 'target.team_id')}
    AND ${stored} AND ${receipt}`)
    .bind(subject.kind, subject.id, event.at, event.actor, event.issueId, JSON.stringify(identifiers), ...storedValues, event.id, event.issueId, event.actor));
  return statements;
}

/** Links retain the typed key and name the currently visible native target. */
export async function readIssueReferences(db: D1Database, actor: string, identifiers: readonly string[]): Promise<IssueReference[]> {
  if (!identifiers.length) return [];
  const rows = await db.prepare(`SELECT keys.value identifier,i.identifier canonicalIdentifier,i.title,s.id statusId,s.name statusName,s.category statusCategory
    FROM json_each(?) keys JOIN operators actor ON actor.id=? AND actor.removed_at IS NULL
    JOIN issues i ON i.id=${aliasTargetSql('actor.workspace_id','keys.value')} JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id AND s.team_id=i.team_id
    WHERE actor.workspace_id=t.workspace_id AND ${visibleTeam('actor', 'i.team_id')}
    ORDER BY i.identifier`).bind(JSON.stringify(identifiers), actor).all<{
      identifier: string; canonicalIdentifier:string; title: string; statusId: string; statusName: string; statusCategory: string;
    }>();
  return rows.results.map(row => ({ identifier: row.identifier, ...(row.canonicalIdentifier!==row.identifier?{canonicalIdentifier:row.canonicalIdentifier}:{}), title: row.title,
    status: { id: row.statusId, name: row.statusName, category: row.statusCategory } }));
}

/** Rendering follows the current reader's scope, even when the original author
 * could not see a target at save time. Backlink admission stays author-scoped. */
export async function readSourceIssueReferences(db: D1Database, actor: string, sourceIssueId: string): Promise<IssueReference[]> {
  const rows = await db.prepare(`SELECT description body FROM issues WHERE id=?
    UNION ALL SELECT body FROM issue_comments WHERE issue_id=? AND deleted_at IS NULL AND body IS NOT NULL`)
    .bind(sourceIssueId, sourceIssueId).all<{ body: string }>();
  const identifiers = [...new Set(rows.results.flatMap(row => extractIssueIdentifiers(row.body)))];
  return readIssueReferences(db, actor, identifiers);
}
