import { z } from 'zod';
import { ToolRefusal, type Person, type ResourceDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { readAdministration } from '../administration/read';
import { projectDetail } from '../projects/read';
import { readDocument } from '../documents/repository';
import { readRelease } from '../releases/repository';
import { readInitiative } from '../initiatives/repository';
import { readTemplate } from '../project-templates/service';
import { nativeId, nativeRead } from './reads.ts';
import { planningRow, standard } from './planning-shared.ts';

export function vectorPlanningResources(env: WorkerBindings): ResourceDefinition[] {
  const resource = (kind: string, name: string, scope: string,
    read: (db: D1Database, person: Person, id: string) => Promise<unknown>): ResourceDefinition => ({
    uriTemplate: `vector://${kind}/{id}`, name, scope, classes: ['standard'],
    classify: record => standard(record.json == null ? 0 : 1),
    async read(uri, ctx) {
      try {
        const id = nativeId.parse(decodeURIComponent(uri.split('/').at(-1)!));
        const json = await nativeRead(env, ctx.person, db => read(db, ctx.person, id));
        return { json, untrusted: true };
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof URIError || error instanceof ToolRefusal && ['not_found', 'forbidden'].includes(error.code)) return null;
        throw error;
      }
    },
  });
  return [
    resource('documents', 'Internal document and discussion', 'documents:read', (db, p, id) => readDocument(db, p.id, id)),
    resource('releases', 'Release plan and scope', 'releases:read', (db, p, id) => readRelease(db, p.id, id)),
    resource('initiatives', 'Initiative hierarchy and project selection', 'initiatives:read', (db, p, id) => readInitiative(db, p.id, id)),
    resource('project-templates', 'Native project template', 'projects:read', (db, p, id) => readTemplate(db, p.id, id)),
    resource('teams', 'Visible team planning settings', 'teams:read', async (db, p, id) => {
      await planningRow(db, 'teams', id);
      const value = (await readAdministration(db, p.id)).teams.find(t => t.id === id);
      if (!value) throw new ToolRefusal('not_found'); return value;
    }),
    resource('labels', 'Native workspace label', 'metadata:read', async (db, p, id) => {
      const value = (await readAdministration(db, p.id)).labels.find(l => l.id === id);
      if (!value) throw new ToolRefusal('not_found'); return value;
    }),
    resource('statuses', 'Native team workflow status', 'metadata:read', async (db, p, id) => {
      const row = await planningRow(db, 'workflow_statuses', id);
      const value = (await readAdministration(db, p.id)).teams.find(t => t.id === row.team_id)?.statuses.find(s => s.id === id);
      if (!value) throw new ToolRefusal('not_found'); return value;
    }),
    resource('milestones', 'Project milestone', 'projects:read', async (db, p, id) => {
      const row = await planningRow(db, 'project_milestones', id);
      const project = await projectDetail(db, p.id, String(row.project_id));
      const value = project?.milestones.find(m => m.id === id);
      if (!value) throw new ToolRefusal('not_found'); return value;
    }),
  ];
}
