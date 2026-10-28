import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { projectCreateSchema, projectUpdateSchema, projectMilestoneCreateSchema, projectMilestoneUpdateSchema, projectMilestoneOrderSchema } from '../administration/schema';
import { createProject, updateProject, removeProject } from '../administration/projects';
import { createProjectMilestone, updateProjectMilestone, reorderProjectMilestones, removeProjectMilestone } from '../administration/project-milestones';
import { projectDetail, projectPortfolio } from '../projects/read';
import { projectPortfolioQuery } from '../projects/portfolio';
import { ToolRefusal } from '../../../../vendor/base/agent-door/index.ts';
import { nativeMutation } from './native.ts';
import { idArgs, nativeId } from './reads.ts';
import { destructive, planningRead, planningRevision, planningRow, projectLoss, requiredPlanning, standard } from './planning-shared.ts';

const projectUri = (_result: unknown, args: any) => `vector://projects/${args.id}`;
const project = async (db: D1Database, actor: string, id: string) => {
  const value = await projectDetail(db, actor, id);
  if (!value) throw new ToolRefusal('not_found');
  return value;
};
const milestoneArgs = z.object({ id: nativeId, milestoneId: nativeId }).strict();
const milestoneParams = (args: any) => ({ id: args.id, milestoneId: args.milestoneId });
const milestoneUri = (_result: unknown, args: any) => `vector://milestones/${args.milestoneId}`;

export function planningProjectTools(env: WorkerBindings): ToolDefinition[] {
  const edit = (name: string, title: string, clauses: string[], schema: z.ZodType<any>) => nativeMutation(env, {
    name, title, scope: 'projects:write', clauses, schema: z.object({ id: nativeId, input: schema }).strict(),
    method: 'PATCH', path: '/settings/projects/:id', params: a => ({ id: a.id }), body: a => a.input,
    revision: (db, _p, a) => planningRevision(db, 'projects', a.id), uri: projectUri,
    run: async (db, p, a) => { await updateProject(db, p.id, a.id, a.input); return project(db, p.id, a.id); },
  });
  return [
    nativeMutation(env, {
      name: 'vector.proj.project_record', title: 'Create a project', scope: 'projects:write', clauses: ['PROJ-001'],
      schema: projectCreateSchema.omit({ createSlackChannel: true }), method: 'POST', path: '/settings/projects',
      run: async (db, p, a) => project(db, p.id, await createProject(db, p.id, a)),
      uri: result => `vector://projects/${result.id}`,
    }),
    edit('vector.proj.project_record.edit', 'Edit a project', ['PROJ-001', 'PROJ-002', 'PROJ-009'], projectUpdateSchema),
    edit('vector.proj.manual_lifecycle', 'Set the manual project lifecycle', ['PROJ-002'],
      z.object({ lifecycle: projectUpdateSchema.shape.lifecycle.unwrap() }).strict()),
    edit('vector.proj.project_archiving', 'Archive or unarchive a project', ['PROJ-009'], z.object({ archived: z.boolean() }).strict()),
    nativeMutation(env, {
      name: 'vector.proj.project_record.delete', title: 'Permanently remove a project and its retained planning content',
      scope: 'projects:write', clauses: ['PROJ-001'], schema: idArgs, method: 'DELETE',
      path: '/settings/projects/:id', params: a => ({ id: a.id }), classes: ['destructive'],
      classify: async (db, _p, a) => destructive(await projectLoss(db, a.id)),
      revision: async (db, _p, a) => JSON.stringify([await planningRow(db, 'projects', a.id), await projectLoss(db, a.id)]),
      summary: async (db, _p, a) => ({ target: { id: a.id, name: String((await planningRow(db, 'projects', a.id)).name) },
        items: ['Permanently remove this project, its milestones, documents and retained project history; keep issues and detach their project.'] }),
      run: async (db, p, a) => { await removeProject(db, p.id, a.id); return { id: a.id, deleted: true }; }, uri: projectUri, resource: false,
    }),
    nativeMutation(env, {
      name: 'vector.proj.milestones', title: 'Create a project milestone', scope: 'projects:write', clauses: ['PROJ-011'],
      schema: z.object({ id: nativeId, input: projectMilestoneCreateSchema }).strict(), method: 'POST',
      path: '/settings/projects/:id/milestones', params: a => ({ id: a.id }), body: a => a.input,
      run: async (db, p, a) => {
        const milestoneId = await createProjectMilestone(db, p.id, a.id, a.input);
        return requiredPlanning((await project(db, p.id, a.id)).milestones.find(m => m.id === milestoneId));
      }, uri: result => `vector://milestones/${result.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.proj.milestones.edit', title: 'Edit a project milestone', scope: 'projects:write', clauses: ['PROJ-011'],
      schema: milestoneArgs.extend({ input: projectMilestoneUpdateSchema }), method: 'PATCH',
      path: '/settings/projects/:id/milestones/:milestoneId', params: milestoneParams, body: a => a.input,
      revision: (db, _p, a) => planningRevision(db, 'project_milestones', a.milestoneId),
      run: async (db, p, a) => {
        await updateProjectMilestone(db, p.id, a.id, a.milestoneId, a.input);
        return requiredPlanning((await project(db, p.id, a.id)).milestones.find(m => m.id === a.milestoneId));
      }, uri: milestoneUri,
    }),
    nativeMutation(env, {
      name: 'vector.proj.milestones.order', title: 'Order all milestones in a project', scope: 'projects:write', clauses: ['PROJ-011'],
      schema: z.object({ id: nativeId, input: projectMilestoneOrderSchema }).strict(), method: 'PUT',
      path: '/settings/projects/:id/milestones/order', params: a => ({ id: a.id }), body: a => a.input,
      classify: async (_db, _p, a) => standard(a.input.milestoneIds.length),
      run: async (db, p, a) => { await reorderProjectMilestones(db, p.id, a.id, a.input.milestoneIds); return project(db, p.id, a.id); }, uri: projectUri,
    }),
    nativeMutation(env, {
      name: 'vector.proj.milestones.delete', title: 'Permanently remove a milestone and detach its issues', scope: 'projects:write',
      clauses: ['PROJ-011'], schema: milestoneArgs, method: 'DELETE',
      path: '/settings/projects/:id/milestones/:milestoneId', params: milestoneParams, classes: ['destructive'],
      classify: async (db, _p, a) => { const row = await planningRow(db, 'project_milestones', a.milestoneId);
        if (row.project_id !== a.id) throw new ToolRefusal('not_found'); return destructive(1); },
      revision: (db, _p, a) => planningRevision(db, 'project_milestones', a.milestoneId),
      run: async (db, p, a) => { await removeProjectMilestone(db, p.id, a.id, a.milestoneId); return { id: a.milestoneId, deleted: true }; }, uri: milestoneUri, resource: false,
    }),
    ...([
      ['vector.proj.progress', 'Read project progress', ['PROJ-004']],
      ['vector.proj.health', 'Read explainable project health', ['PROJ-005']],
      ['vector.proj.risk_explanation', 'Read project risk evidence', ['PROJ-006']],
      ['vector.proj.historical_truth', 'Read retained project activity and cycle history', ['PROJ-008']],
    ] as const).map(([name, title, clauses]) => planningRead(env, { name, title, clauses: [...clauses], scope: 'projects:read', schema: idArgs,
      read: (db, p, a) => project(db, p.id, a.id), uri: a => `vector://projects/${a.id}` })),
    planningRead(env, { name: 'vector.proj.portfolio', title: 'Read the visible project portfolio', scope: 'projects:read',
      clauses: ['PROJ-007'], schema: projectPortfolioQuery, read: (db, p, a) => projectPortfolio(db, p.id, a) }),
  ];
}
