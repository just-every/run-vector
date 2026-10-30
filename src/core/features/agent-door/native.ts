import { nativeInputSchema } from './schema.ts';
import { z } from 'zod';
import { ToolRefusal, type ApprovalSummary, type ClassAndFacts, type ClassId, type Person, type ToolContext, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { actionAuthority } from '../roles/enforcement';
import { visibilityDatabase } from '../roles/visibility-database';
import { mutationDatabase, isMutationAccessError, AuthorityChangedError, VisibilityChangedError } from '../auth/mutation-database';
import { configureNotifications } from '../notifications/context';
import { nativeRead, readIssue } from './reads.ts';
import { vectorPeople } from './people.ts';
import { requireAgentProviderBoundary } from './provider-boundary.ts';

export interface NativeMutation<A = any> {
  name: string; title: string; scope: string; clauses: string[]; schema: z.ZodType<A>;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string;
  params?(args: A): Record<string, string>; body?(args: A): unknown;
  run(db: D1Database, person: Person, args: A): Promise<unknown>;
  uri?(result: any, args: A): string;
  resource?: boolean;
  revision?(db: D1Database, person: Person, args: A): Promise<number | string | null>;
  classes?: ClassId[];
  classify?(db: D1Database, person: Person, args: A): Promise<ClassAndFacts[]>;
  summary?(db: D1Database, person: Person, args: A): Promise<ApprovalSummary>;
}

/** The UI's role decision and native transaction fence are also the tool's.
 * No synthetic operator, browser session or provider credential is created. */
async function admitted<A>(env: WorkerBindings, spec: NativeMutation<A>, args: A, ctx: ToolContext) {
  if (!(await vectorPeople(env).person(ctx.person.id))) throw new ToolRefusal('unauthenticated');
  const authority = await actionAuthority(env.DB, ctx.person.id, spec.method, spec.path,
    spec.params?.(args) ?? {}, spec.body?.(args) ?? args);
  if (authority.decision !== 'allow') throw new ToolRefusal(authority.decision === 'hidden' ? 'not_found' : authority.decision);
  return authority.fence;
}

function refusal(error: unknown, tool?: string): never {
  if (error instanceof ToolRefusal) throw error;
  if (error instanceof z.ZodError) throw new ToolRefusal('invalid_arguments');
  if (isMutationAccessError(error)) throw new ToolRefusal('unauthenticated');
  if (error instanceof AuthorityChangedError) throw new ToolRefusal('authority_changed');
  if (error instanceof VisibilityChangedError) throw new ToolRefusal('not_found');
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    throw new ToolRefusal(error.code.endsWith('not_found') ? 'not_found' : error.code);
  }
  if (error instanceof Error) console.error('Native agent tool failure', tool, error.name,
    error.stack?.split('\n').filter(line => line.trimStart().startsWith('at ')).join('\n'));
  throw error;
}

export function nativeMutation(env: WorkerBindings, spec: NativeMutation): ToolDefinition {
  const parse = (args: Record<string, unknown>) => spec.schema.parse(args);
  return {
    name: spec.name, title: spec.title, description: spec.title, scope: spec.scope,
    clauses: spec.clauses, readOnly: false, untrusted: true,
    inputSchema: nativeInputSchema(spec.schema),
    outputSchema: { type: 'object', additionalProperties: true }, classes: spec.classes ?? ['standard'],
    async classify(args, ctx) {
      try {
        const input = parse(args); await admitted(env, spec, input, ctx);
        await requireAgentProviderBoundary(env, ctx.person.id);
        return spec.classify ? await nativeRead(env, ctx.person, db => spec.classify!(db, ctx.person, input))
          : [{ class: 'standard', facts: { measure: 1 } }];
      } catch (error) { return refusal(error, spec.name); }
    },
    async summary(args, ctx) {
      try {
      const input = parse(args);
      if (spec.summary) return nativeRead(env, ctx.person, db => spec.summary!(db, ctx.person, input));
      const value = input as Record<string, unknown>;
      const effect = value.input && typeof value.input === 'object' ? value.input : value;
      const items = Object.entries(effect).map(([field, proposed]) => `${field}: ${JSON.stringify(proposed)}`);
      if (typeof value.identifier === 'string') {
        const issue = await readIssue(env, ctx.person, value.identifier);
        return { target: { id: issue.id, name: issue.identifier + ': ' + issue.title }, items };
      }
      return { ...(typeof value.id === 'string' ? { target: { id: value.id } } : {}), items: [spec.title, ...items] };
      } catch (error) { return refusal(error, spec.name); }
    },
    ...(spec.revision ? {
      revisionType: 'string' as const,
      async revision(args: Record<string, unknown>, ctx: ToolContext) {
        const value = await nativeRead(env, ctx.person, db => spec.revision!(db, ctx.person, parse(args)));
        return value === null ? null : String(value);
      },
    } : {}),
    async run(args, ctx) {
      try {
        const input = parse(args), fence = await admitted(env, spec, input, ctx);
        const providerFence = await requireAgentProviderBoundary(env, ctx.person.id);
        const db = visibilityDatabase(mutationDatabase(env.DB, ctx.person.id, undefined,
          providerFence, fence, { agent: ctx.agent, person: ctx.person, consent: ctx.consent, approvers: ctx.approvers }), ctx.person.id);
        configureNotifications(db, env);
        const result = await spec.run(db, ctx.person, input);
        if (!(await vectorPeople(env).person(ctx.person.id))) throw new ToolRefusal('unauthenticated');
        const uri = spec.uri?.(result, input);
        if (uri) ctx.emit(spec.name.slice(7), uri, { approvers: ctx.approvers });
        return { result: result !== null && typeof result === 'object' ? result : result === undefined ? { written: true } : { id: result },
          ...(uri && spec.resource !== false ? { resources: [{ uri, name: spec.title }] } : {}) };
      } catch (error) { return refusal(error, spec.name); }
    },
  };
}
