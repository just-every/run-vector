import type { SqlStatement } from '../../../../vendor/base/integrations';
import { createUlid } from '../../shared/ids';
import type { AuditEntry } from './schema';

/** Add this statement to the subject's own transaction. Only opaque references,
 * action and provenance belong here; never credentials or request bodies. */
export function auditStatement(input: {
  workspace: string; actor: string; action: string; subject: string;
  kind?: Exclude<AuditEntry['actorKind'], 'unknown'>; at?: string; condition?: SqlStatement;
}): SqlStatement & {params: NonNullable<SqlStatement['params']>} {
  const at = input.at ?? new Date().toISOString();
  const kind = input.kind ?? 'person';
  return {
    sql: `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
      SELECT ?,?,?,?,?,?,?,?,?,?${input.condition ? ' WHERE ('+input.condition.sql+')' : ''}`,
    params: [createUlid(new Date(at)), kind === 'person' ? input.actor : null, input.action, input.subject, input.subject,
      at, at, input.workspace, kind, `${kind}:${input.actor}`, ...(input.condition?.params ?? [])],
  };
}
