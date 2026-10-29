import type { NativeTarget, ToolContext } from '../../../../vendor/base/agent-door/types.ts';
import { ToolRefusal } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import type { NativeMutation } from './native.ts';
import { nativeRead, readIssue } from './reads.ts';

// Route-to-table mappings are native source, never caller-controlled SQL.
const records = [
  [/^\/settings\/projects\/:id(?:\/|$)/, 'projects', 'project', 'id'],
  [/^\/settings\/teams\/:id(?:\/|$)/, 'teams', 'team', 'id'],
  [/^\/teams\/:teamId(?:\/|$)/, 'teams', 'team', 'teamId'],
  [/^\/settings\/labels\/:id(?:\/|$)/, 'labels', 'label', 'id'],
  [/^\/cycles\/:id(?:\/|$)/, 'cycles', 'cycle', 'id'],
  [/^\/documents\/:documentId(?:\/|$)/, 'documents', 'document', 'documentId'],
  [/^\/initiatives\/:id(?:\/|$)/, 'initiatives', 'initiative', 'id'],
  [/^\/releases\/:id(?:\/|$)/, 'releases', 'release', 'id'],
  [/^\/views\/:id(?:\/|$)/, 'saved_views', 'saved_view', 'id'],
  [/^\/project-templates\/:id(?:\/|$)/, 'project_templates', 'project_template', 'id'],
] as const;

/** Resolve only through the same current native visibility and permission row.
 * Creates and aggregate commands have no existing single-record target. */
export async function mutationTarget(env: WorkerBindings, spec: NativeMutation, args: any, ctx: ToolContext): Promise<NativeTarget | null> {
  if (typeof args.identifier === 'string') return { kind: 'issue', id: (await readIssue(env, ctx.person, args.identifier)).id };
  const mapping = records.find(([path]) => path.test(spec.path));
  if (!mapping) return null;
  const [, table, kind, parameter] = mapping;
  const id = spec.params?.(args)?.[parameter];
  if (!id) return null;
  return nativeRead(env, ctx.person, async db => {
    const row = await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first<{ id: string }>();
    if (!row) throw new ToolRefusal('not_found');
    return { kind, id: row.id };
  });
}
