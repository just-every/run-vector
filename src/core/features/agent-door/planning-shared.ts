import { z } from 'zod';
import { ToolRefusal, type ClassAndFacts, type JsonSchemaObject, type Person, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { nativeRead } from './reads.ts';

export const standard = (measure = 1): ClassAndFacts[] => [{ class: 'standard', facts: { measure } }];
export const destructive = (measure: number): ClassAndFacts[] => [{ class: 'destructive', facts: { measure } }];
export function requiredPlanning<T>(value: T | null | undefined): T {
  if (value == null) throw new ToolRefusal('not_found');
  return value;
}

export function planningRead(env: WorkerBindings, spec: {
  name: string; title: string; scope: string; clauses: string[]; schema: z.ZodType;
  read: (db: D1Database, person: Person, args: any) => Promise<unknown>;
  uri?: (args: any) => string;
}): ToolDefinition {
  return { name: spec.name, title: spec.title, description: spec.title, scope: spec.scope,
    readOnly: true, untrusted: true, classes: ['standard'], clauses: spec.clauses,
    inputSchema: z.toJSONSchema(spec.schema, { io: 'input', unrepresentable: 'any' }) as JsonSchemaObject,
    outputSchema: { type: 'object', additionalProperties: true }, classify: () => standard(),
    async run(args, ctx) {
      const parsed = spec.schema.parse(args);
      const result = await nativeRead(env, ctx.person, db => spec.read(db, ctx.person, parsed));
      return { result, ...(spec.uri ? { resources: [{ uri: spec.uri(parsed), name: spec.title }] } : {}) };
    },
  };
}

type PlanningTable = 'projects' | 'project_milestones' | 'labels' | 'teams' | 'workflow_statuses'
  | 'cycles' | 'releases' | 'initiatives' | 'documents' | 'project_templates';
/** The helper supplies a visibility-scoped database after native admission. */
export async function planningRow(db: D1Database, table: PlanningTable, id: string) {
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<Record<string, unknown>>();
  if (!row) throw new ToolRefusal('not_found');
  return row;
}
export const planningRevision = async (db: D1Database, table: PlanningTable, id: string) =>
  JSON.stringify(await planningRow(db, table, id));

/** Count primary records and retained content actually erased by project removal.
 * Link/index rows are relationships rather than additional content records. */
export async function projectLoss(db: D1Database, id: string) {
  await planningRow(db, 'projects', id);
  return (await db.prepare(`SELECT 1
    +(SELECT count(*) FROM main.project_milestones WHERE project_id=?)
    +(SELECT count(*) FROM main.project_activity WHERE project_id=?)
    +(SELECT count(*) FROM main.project_membership_events WHERE project_id=?)
    +(SELECT count(*) FROM main.project_report_days WHERE project_id=?)
    +(SELECT count(*) FROM main.project_report_snapshots WHERE project_id=?)
    +(SELECT count(*) FROM main.documents WHERE parent_kind='project' AND parent_id=?)
    +(SELECT count(*) FROM main.document_revisions WHERE document_id IN(SELECT id FROM main.documents WHERE parent_kind='project' AND parent_id=?))
    +(SELECT count(*) FROM main.document_comments WHERE document_id IN(SELECT id FROM main.documents WHERE parent_kind='project' AND parent_id=?)) AS n`)
    .bind(id, id, id, id, id, id, id, id).first<number>('n'))!;
}
