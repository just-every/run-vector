import { z } from 'zod';
import { ToolRefusal, type Person, type ToolDefinition, type JsonSchemaObject } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { requireIssueAccess } from '../issues/access';
import { getIssueDetail } from '../issues/service';
import { nativeMutation, type NativeMutation } from './native.ts';
import { identifier, nativeId, nativeRead } from './reads.ts';

export { identifier, nativeId };
export const version = z.number().int().positive();
export const issueInput = (input: z.ZodType) => z.object({ identifier, input }).strict();
export const issueParams = (args: any) => ({ identifier: args.identifier });
export const issueUri = (_result: unknown, args: any) => `vector://issues/${args.identifier}`;
export async function issueRevision(db: D1Database, person: Person, args: any) {
  return args.identifier ? (await requireIssueAccess(db, args.identifier, person.id)).version : null;
}
export function written(outcome: unknown) {
  if (outcome === 'stale') throw new ToolRefusal('stale_version', 'The issue changed. Read its current version before continuing.');
}
export async function issueDetail(db: D1Database, person: Person, key: string) {
  await requireIssueAccess(db, key, person.id);
  const issue = await getIssueDetail(db, key, new Date());
  await requireIssueAccess(db, key, person.id);
  if (!issue) throw new ToolRefusal('not_found');
  return issue;
}
type Mutation = NativeMutation<any>;
export function issueMutation(env: WorkerBindings, spec: Omit<Mutation, 'scope'> & { scope?: string }): ToolDefinition {
  return nativeMutation(env, {
    scope: 'issues:write', params: issueParams, body: args => args.input ?? args,
    revision: issueRevision, uri: issueUri, ...spec, name: `vector.${spec.name}`,
  });
}
type Read = (db: D1Database, person: Person, args: any) => Promise<unknown>;
export function issueRead(env: WorkerBindings, name: string, title: string, clauses: string[], schema: z.ZodType, read: Read): ToolDefinition {
  return {
    name: `vector.${name}`, title, description: title, scope: 'issues:read', readOnly: true,
    clauses, classes: ['standard'], classify: () => [{ class: 'standard', facts: { measure: 1 } }],
    inputSchema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchemaObject,
    outputSchema: { type: 'object', additionalProperties: true }, untrusted: true,
    async summary(args, ctx) {
      const parsed = schema.parse(args) as any;
      return nativeRead(env, ctx.person, async db => {
        if (parsed.identifier) {
          const issue = await issueDetail(db, ctx.person, parsed.identifier);
          return { target: { id: issue.id, name: `${issue.identifier}: ${issue.title}` } };
        }
        if (parsed.teamId) {
          const name = await db.prepare('SELECT name FROM teams WHERE id=?').bind(parsed.teamId).first<string>('name');
          if (!name) throw new ToolRefusal('not_found');
          return { target: { id: parsed.teamId, name } };
        }
        return { items: [title] };
      });
    },
    revisionType: 'integer',
    revision: (args, ctx) => nativeRead(env, ctx.person, db => issueRevision(db, ctx.person, schema.parse(args))),
    async run(args, ctx) {
      const parsed = schema.parse(args);
      return { result: await nativeRead(env, ctx.person, db => read(db, ctx.person, parsed)),
        ...(typeof args.identifier === 'string' ? { resources: [{ uri: `vector://issues/${args.identifier}`, name: title }] } : {}) };
    },
  };
}
