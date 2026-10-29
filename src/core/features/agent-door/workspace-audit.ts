import { z } from 'zod';
import { ToolRefusal, type ResourceDefinition, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { readAudit } from '../audit/repository';
import { auditCsv } from '../audit/csv';
import { auditQuerySchema } from '../audit/schema';
import { nativeRead } from './reads.ts';
import { workspaceRead } from './workspace-shared.ts';

export function workspaceAuditTools(env: WorkerBindings): ToolDefinition[] {
  return [
    workspaceRead(env, { name: 'role.audit_log', title: 'Read the native workspace audit log as an Owner or Admin',
      scope: 'audit:read', clauses: ['ROLE-005'], schema: auditQuerySchema,
      read: (db, person, args) => readAudit(db, person.id, args) }),
    workspaceRead(env, { name: 'role.audit_log.export', title: 'Export the native workspace audit log as CSV',
      scope: 'audit:read', clauses: ['ROLE-005'], schema: auditQuerySchema,
      read: async (db, person, args) => ({ contentType: 'text/csv; charset=utf-8', csv: auditCsv((await readAudit(db, person.id, args)).entries) }) }),
  ];
}

export function workspaceAuditResource(env: WorkerBindings): ResourceDefinition {
  return { uriTemplate: 'vector://audit/{id}', name: 'Native audit entry', scope: 'audit:read', classes: ['standard'],
    classify: record => [{ class: 'standard', facts: { measure: record.json == null ? 0 : 1 } }],
    async read(uri, ctx) {
      try {
        const id = z.string().min(1).parse(decodeURIComponent(uri.split('/').at(-1)!));
        const record = await nativeRead(env, ctx.person, async db => (await readAudit(db, ctx.person.id, {})).entries.find(row => row.id === id));
        return record ? { json: record, untrusted: true } : null;
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof URIError || error instanceof ToolRefusal && ['forbidden', 'not_found'].includes(error.code)) return null;
        throw error;
      }
    },
  };
}
