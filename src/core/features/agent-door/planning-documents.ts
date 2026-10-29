import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { documentInput, documentEdit, documentComment, parentKind, specificationInput } from '../documents/schema';
import { listDocuments, readDocument, documentRevisions, documentComments, createDocument, editDocument,
  commentDocument, setSpecification, issueSpecification } from '../documents/repository';
import { requireIssueAccess } from '../issues/access';
import { nativeMutation } from './native.ts';
import { idArgs, nativeId, issueArgs } from './reads.ts';
import { planningRead, planningRevision } from './planning-shared.ts';

export function planningDocumentTools(env: WorkerBindings): ToolDefinition[] {
  return [
    nativeMutation(env, {
      name: 'vector.proj.project_documents_and_specs', title: 'Create an internal document on a project, issue, initiative or team',
      scope: 'documents:write', clauses: ['PROJ-013'], schema: documentInput, method: 'POST', path: '/documents',
      run: (db, p, a) => createDocument(db, p.id, a), uri: r => `vector://documents/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_documents_and_specs.edit', title: 'Edit a document and retain its previous revision',
      scope: 'documents:write', clauses: ['PROJ-013'], schema: z.object({ id: nativeId, input: documentEdit }).strict(),
      method: 'PATCH', path: '/documents/:documentId', params: a => ({ documentId: a.id }), body: a => a.input,
      revision: (db, _p, a) => planningRevision(db, 'documents', a.id),
      run: (db, p, a) => editDocument(db, p.id, a.id, a.input), uri: r => `vector://documents/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_documents_and_specs.comment', title: 'Comment on a document', scope: 'documents:write',
      clauses: ['PROJ-013'], schema: z.object({ id: nativeId, input: documentComment }).strict(),
      method: 'POST', path: '/documents/:documentId/comments', params: a => ({ documentId: a.id }), body: a => a.input,
      run: (db, p, a) => commentDocument(db, p.id, a.id, a.input.body), uri: r => `vector://documents/${r.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_documents_and_specs.link', title: 'Link an existing document as an issue specification',
      scope: 'documents:write', clauses: ['PROJ-013'], schema: issueArgs.extend({ input: specificationInput }),
      method: 'PUT', path: '/issues/:identifier/specification', params: a => ({ identifier: a.identifier }), body: a => a.input,
      run: async (db, p, a) => { await requireIssueAccess(db, a.identifier, p.id);
        return setSpecification(db, p.id, a.identifier, a.input.documentId); },
      uri: (_r, a) => `vector://issues/${a.identifier}`,
    }),
    nativeMutation(env, {
      name: 'vector.proj.project_documents_and_specs.unlink', title: 'Unlink an issue specification while retaining the document',
      scope: 'documents:write', clauses: ['PROJ-013'], schema: issueArgs, method: 'DELETE',
      path: '/issues/:identifier/specification', params: a => ({ identifier: a.identifier }),
      run: async (db, p, a) => { await requireIssueAccess(db, a.identifier, p.id); return setSpecification(db, p.id, a.identifier, null); },
      uri: (_r, a) => `vector://issues/${a.identifier}`,
    }),
    planningRead(env, {
      name: 'vector.proj.project_documents_and_specs.list', title: 'List visible internal documents', scope: 'documents:read', clauses: ['PROJ-013'],
      schema: z.object({ parentKind: parentKind.optional(), parentId: nativeId.optional() }).strict().refine(v => !!v.parentKind === !!v.parentId),
      read: (db, p, a) => listDocuments(db, p.id, a.parentKind, a.parentId),
    }),
    planningRead(env, {
      name: 'vector.proj.project_documents_and_specs.read', title: 'Read an internal document and its recent discussion', scope: 'documents:read',
      clauses: ['PROJ-013'], schema: idArgs, read: (db, p, a) => readDocument(db, p.id, a.id), uri: a => `vector://documents/${a.id}`,
    }),
    planningRead(env, {
      name: 'vector.proj.project_documents_and_specs.revisions', title: 'Read retained document revisions', scope: 'documents:read', clauses: ['PROJ-013'],
      schema: idArgs.extend({ beforeVersion: z.number().int().positive().optional() }),
      read: (db, p, a) => documentRevisions(db, p.id, a.id, a.beforeVersion), uri: a => `vector://documents/${a.id}`,
    }),
    planningRead(env, {
      name: 'vector.proj.project_documents_and_specs.comments', title: 'Read document discussion', scope: 'documents:read', clauses: ['PROJ-013'],
      schema: idArgs.extend({ beforeComment: nativeId.optional() }), read: (db, p, a) => documentComments(db, p.id, a.id, a.beforeComment),
      uri: a => `vector://documents/${a.id}`,
    }),
    planningRead(env, {
      name: 'vector.proj.project_documents_and_specs.specification', title: 'Read an issue specification link', scope: 'documents:read',
      clauses: ['PROJ-013'], schema: issueArgs, read: async (db, p, a) => {
        await requireIssueAccess(db, a.identifier, p.id); return { specification: await issueSpecification(db, a.identifier) };
      }, uri: a => `vector://issues/${a.identifier}`,
    }),
  ];
}
