import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { releaseInput, releaseEdit, releaseScope } from '../releases/schema';
import { listReleases, readRelease, createRelease, editRelease, replaceReleaseScope } from '../releases/repository';
import { initiativeInput, initiativeEdit, initiativeProjects } from '../initiatives/schema';
import { listInitiatives, readInitiative, createInitiative, editInitiative, replaceInitiativeProjects } from '../initiatives/repository';
import { nativeMutation } from './native.ts';
import { idArgs, nativeId } from './reads.ts';
import { planningRead, planningRevision } from './planning-shared.ts';

export function planningPortfolioTools(env: WorkerBindings): ToolDefinition[] {
  return [
    nativeMutation(env, {
      name: 'vector.init.initiatives', title: 'Create a native initiative', scope: 'initiatives:write', clauses: ['INIT-001'],
      schema: initiativeInput, method: 'POST', path: '/initiatives', run: (db, p, a) => createInitiative(db, p.id, a),
      uri: r => `vector://initiatives/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.init.initiatives.edit', title: 'Edit an initiative and its hierarchy', scope: 'initiatives:write', clauses: ['INIT-001'],
      schema: z.object({ id: nativeId, input: initiativeEdit }).strict(), method: 'PATCH', path: '/initiatives/:id',
      params: a => ({ id: a.id }), body: a => a.input, revision: (db, _p, a) => planningRevision(db, 'initiatives', a.id),
      run: (db, p, a) => editInitiative(db, p.id, a.id, a.input), uri: r => `vector://initiatives/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.init.initiatives.projects', title: 'Replace an initiative project selection', scope: 'initiatives:write',
      clauses: ['INIT-001', 'INIT-002'], schema: z.object({ id: nativeId, input: initiativeProjects }).strict(),
      method: 'PUT', path: '/initiatives/:id/projects', params: a => ({ id: a.id }), body: a => a.input,
      revision: (db, _p, a) => planningRevision(db, 'initiatives', a.id),
      run: (db, p, a) => replaceInitiativeProjects(db, p.id, a.id, a.input), uri: r => `vector://initiatives/${r.id}`,
    }),
    planningRead(env, {
      name: 'vector.init.initiatives.list', title: 'Read visible initiatives', scope: 'initiatives:read', clauses: ['INIT-001'],
      schema: z.object({}).strict(), read: (db, p) => listInitiatives(db, p.id),
    }),
    planningRead(env, {
      name: 'vector.init.initiative_roll_up', title: 'Read an initiative hierarchy and its visible projects', scope: 'initiatives:read',
      clauses: ['INIT-002'], schema: idArgs, read: (db, p, a) => readInitiative(db, p.id, a.id), uri: a => `vector://initiatives/${a.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.release.releases', title: 'Create a native release plan', scope: 'releases:write', clauses: ['RELEASE-001'],
      schema: releaseInput, method: 'POST', path: '/releases', run: (db, p, a) => createRelease(db, p.id, a),
      uri: r => `vector://releases/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.release.releases.edit', title: 'Edit a native release plan or its status', scope: 'releases:write', clauses: ['RELEASE-001'],
      schema: z.object({ id: nativeId, input: releaseEdit }).strict(), method: 'PATCH', path: '/releases/:id',
      params: a => ({ id: a.id }), body: a => a.input, revision: (db, _p, a) => planningRevision(db, 'releases', a.id),
      run: (db, p, a) => editRelease(db, p.id, a.id, a.input), uri: r => `vector://releases/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.release.releases.scope', title: 'Replace the issues and projects in an unreleased release', scope: 'releases:write',
      clauses: ['RELEASE-001'], schema: z.object({ id: nativeId, input: releaseScope }).strict(),
      method: 'PUT', path: '/releases/:id/scope', params: a => ({ id: a.id }), body: a => a.input,
      revision: (db, _p, a) => planningRevision(db, 'releases', a.id),
      run: (db, p, a) => replaceReleaseScope(db, p.id, a.id, a.input), uri: r => `vector://releases/${r.id}`,
    }),
    planningRead(env, {
      name: 'vector.release.releases.list', title: 'Read visible release plans', scope: 'releases:read', clauses: ['RELEASE-001'],
      schema: z.object({}).strict(), read: (db, p) => listReleases(db, p.id),
    }),
    planningRead(env, {
      name: 'vector.release.releases.read', title: 'Read a release plan, scope, blockers and linked pull requests', scope: 'releases:read',
      clauses: ['RELEASE-001'], schema: idArgs, read: (db, p, a) => readRelease(db, p.id, a.id), uri: a => `vector://releases/${a.id}`,
    }),
  ];
}
