import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { templateInputSchema, applySchema, captureSchema } from '../project-templates/schema';
import { listTemplates, readTemplate, saveTemplate, deleteTemplate, captureTemplate, applyTemplate } from '../project-templates/service';
import { nativeMutation } from './native.ts';
import { idArgs, nativeId } from './reads.ts';
import { destructive, planningRead, planningRevision, standard } from './planning-shared.ts';

export function planningTemplateTools(env: WorkerBindings): ToolDefinition[] {
  const uri = (r: any) => `vector://project-templates/${r.id}`;
  return [
    nativeMutation(env, {
      name: 'vector.proj.project_templates', title: 'Create a project template', scope: 'projects:write', clauses: ['PROJ-012'],
      schema: templateInputSchema, method: 'POST', path: '/project-templates', run: (db, p, a) => saveTemplate(db, p.id, a), uri,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_templates.edit', title: 'Replace a project template at its expected version', scope: 'projects:write',
      clauses: ['PROJ-012'], schema: z.object({ id: nativeId, expectedVersion: z.number().int().positive(), input: templateInputSchema }).strict(),
      method: 'PUT', path: '/project-templates/:id', params: a => ({ id: a.id }), body: a => ({ ...a.input, expectedVersion: a.expectedVersion }),
      revision: (db, _p, a) => planningRevision(db, 'project_templates', a.id),
      run: (db, p, a) => saveTemplate(db, p.id, a.input, a.id, a.expectedVersion), uri,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_templates.capture', title: 'Capture visible project planning as a project template', scope: 'projects:write',
      clauses: ['PROJ-012'], schema: z.object({ id: nativeId, input: captureSchema }).strict(), method: 'POST',
      path: '/project-templates/from-project/:id', params: a => ({ id: a.id }), body: a => a.input,
      run: (db, p, a) => captureTemplate(db, p.id, a.id, a.input), uri,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_templates.apply', title: 'Create a native project and its planned issues from a template', scope: 'projects:write',
      clauses: ['PROJ-012'], schema: z.object({ id: nativeId, input: applySchema }).strict(), method: 'POST',
      path: '/project-templates/:id/apply', params: a => ({ id: a.id }), body: a => a.input,
      revision: (db, _p, a) => planningRevision(db, 'project_templates', a.id),
      classify: async (db, p, a) => {
        const template = await readTemplate(db, p.id, a.id);
        const missingLabels = (await db.prepare(`SELECT count(*) AS n FROM project_template_labels source
          WHERE source.template_id=? AND NOT EXISTS(SELECT 1 FROM labels destination WHERE destination.name=source.name
          AND destination.workspace_id=(SELECT workspace_id FROM operators WHERE id=?))`).bind(a.id, p.id).first<number>('n'))!;
        const role = await db.prepare('SELECT role FROM operators WHERE id=?').bind(p.id).first<string>('role');
        return standard(1 + template.milestones.length + template.issues.length + (['owner', 'admin'].includes(role ?? '') ? missingLabels : 0));
      },
      run: (db, p, a) => applyTemplate(db, p.id, a.id, a.input), uri: r => `vector://projects/${r.projectId}`,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_templates.delete', title: 'Permanently remove a project template and its retained template content',
      scope: 'projects:write', clauses: ['PROJ-012'],
      schema: idArgs.extend({ expectedVersion: z.number().int().positive() }), method: 'DELETE', path: '/project-templates/:id',
      params: a => ({ id: a.id }), body: a => ({ expectedVersion: a.expectedVersion }), classes: ['destructive'],
      revision: (db, _p, a) => planningRevision(db, 'project_templates', a.id),
      classify: async (db, p, a) => { const value = await readTemplate(db, p.id, a.id);
        return destructive(1 + value.milestones.length + value.issues.length + value.labels.length); },
      run: (db, p, a) => deleteTemplate(db, p.id, a.id, a.expectedVersion),
      uri: (_r, a) => `vector://project-templates/${a.id}`, resource: false,
    }),
    planningRead(env, { name: 'vector.proj.project_templates.list', title: 'List visible project templates', scope: 'projects:read',
      clauses: ['PROJ-012'], schema: z.object({}).strict(), read: (db, p) => listTemplates(db, p.id) }),
    planningRead(env, { name: 'vector.proj.project_templates.read', title: 'Read a visible project template', scope: 'projects:read',
      clauses: ['PROJ-012'], schema: idArgs, read: (db, p, a) => readTemplate(db, p.id, a.id), uri: a => `vector://project-templates/${a.id}` }),
  ];
}
