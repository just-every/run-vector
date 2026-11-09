import type { AuditEntry } from './schema';

function cell(value: string | null) {
  // Prevent spreadsheet formula execution while retaining the literal value.
  const text = value ?? '';
  const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function auditCsv(entries: AuditEntry[]) {
  return [['id', 'actor_reference', 'actor_kind', 'actor_name', 'time', 'action', 'subject_reference', 'method'],
    ...entries.map(e => [e.id, e.actorRef, e.actorKind, e.actorName, e.at, e.action, e.subjectRef, e.method ?? null])]
    .map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
