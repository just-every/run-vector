import { z } from 'zod';
import { ToolRefusal, type ClassAndFacts, type Person, type ToolContext, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { actionAuthority } from '../roles/enforcement';
import { nativeMutation, type NativeMutation } from './native.ts';
import { nativeRead } from './reads.ts';
import { nativeInputSchema } from './schema.ts';

/** Native people whose standing changes. A team or workspace is never passed
 * to Base as though it were a person. Aggregate changes prefer the sponsor
 * only when that actual native person's standing is among the changes. */
export type AccessChange = { subjects: string[]; widens: boolean };
export type AccessSpec<A = any> = NativeMutation<A> & {
  change(db: D1Database, person: Person, args: A): Promise<AccessChange>;
  securitySetting?: string;
  narrowing?: ToolDefinition['narrowing'];
};

export const accessFacts = (change: AccessChange, setting?: string): ClassAndFacts[] => [
  { class: 'access', facts: { measure: change.subjects.length, direction: change.widens ? 'widens' : 'narrows' } },
  ...(setting ? [{ class: 'security' as const, facts: { measure: 1, setting } }] : []),
];

// A transient preimage, never stored or logged. This covers precisely the
// standing inputs used by these native access adapters. The service's batch
// receives the comparison in addition to its existing native transaction,
// sponsor, role-matrix and attribution fences.
const standingSql = `SELECT json_object(
  'people',(SELECT json_group_array(json_array(id,role,removed_at)) FROM
    (SELECT id,role,removed_at FROM main.operators WHERE workspace_id=root.workspace_id ORDER BY id)),
  'teams',(SELECT json_group_array(json_array(id,is_private,archived_at,membership_mode,requests_enabled,settings_permission,planning_permission)) FROM
    (SELECT id,is_private,archived_at,membership_mode,requests_enabled,settings_permission,planning_permission FROM main.teams WHERE workspace_id=root.workspace_id ORDER BY id)),
  'members',(SELECT json_group_array(json_array(team_id,operator_id,role)) FROM
    (SELECT m.team_id,m.operator_id,m.role FROM main.team_members m JOIN main.teams t ON t.id=m.team_id WHERE t.workspace_id=root.workspace_id ORDER BY m.team_id,m.operator_id)),
  'workspace',(SELECT json_array(member_invites,member_team_creation,member_label_creation) FROM main.workspace_settings WHERE id=root.workspace_id)
) AS snapshot FROM main.operators root WHERE root.id=? AND root.removed_at IS NULL`;

function fencedStanding(db: D1Database, actor: string, snapshot: string): D1Database {
  return new Proxy(db, { get(target, key) {
    if (key === 'batch') return async (writes: D1PreparedStatement[]) => {
      const guard = target.prepare(`SELECT CASE WHEN (${standingSql})=? THEN 1 ELSE json('native authority changed') END`).bind(actor, snapshot);
      return (await target.batch([guard, ...writes])).slice(1);
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function admits(env: WorkerBindings, spec: NativeMutation, args: any, ctx: ToolContext) {
  const result = await actionAuthority(env.DB, ctx.person.id, spec.method, spec.path,
    spec.params?.(args) ?? {}, spec.body?.(args) ?? args);
  if (result.decision !== 'allow') throw new ToolRefusal(result.decision === 'hidden' ? 'not_found' : result.decision);
}

export function accessMutation(env: WorkerBindings, spec: AccessSpec): ToolDefinition {
  const tool = nativeMutation(env, { ...spec,
    classes: [...new Set(['access' as const, ...(spec.securitySetting ? ['security' as const] : []), ...(spec.classes ?? [])])],
    classify: async (db, person, args) => [...accessFacts(await spec.change(db, person, args), spec.securitySetting),
      ...(spec.classify ? await spec.classify(db, person, args) : [])],
    revision: spec.revision ?? (async (db, person) => {
      const snapshot = await db.prepare(standingSql).bind(person.id).first<string>('snapshot');
      if (snapshot === null) return null;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }),
    async run(db, person, args) {
      const snapshot = await db.prepare(standingSql).bind(person.id).first<string>('snapshot');
      if (!snapshot) throw new ToolRefusal('unauthenticated');
      const change = await spec.change(db, person, args);
      if (change.widens && change.subjects.includes(person.id)) throw new ToolRefusal('self_escalation');
      // The snapshot and effect calculation must describe the same preimage.
      if (snapshot !== await db.prepare(standingSql).bind(person.id).first<string>('snapshot')) throw new ToolRefusal('authority_changed');
      return spec.run(fencedStanding(db, person.id, snapshot), person, args);
    },
  });
  tool.authority = async (raw, ctx) => {
    let args;
    try { args = spec.schema.parse(raw); } catch (error) {
      if (error instanceof z.ZodError) throw new ToolRefusal('invalid_arguments');
      throw error;
    }
    return nativeRead(env, ctx.person, async db => {
      await admits(env, spec, args, ctx);
      const change = await spec.change(db, ctx.person, args);
      const subject = change.subjects.includes(ctx.person.id) ? ctx.person.id : change.subjects[0];
      return subject ? { subject, widens: change.widens } : null;
    });
  };
  if (spec.narrowing) {
    const { type, properties, required, additionalProperties } = tool.inputSchema;
    Object.assign(tool, { widens: false, narrowing: spec.narrowing,
      inputSchema: { type, properties, required, additionalProperties } });
  }
  return tool;
}

export function accessRead(env: WorkerBindings, spec: {
  name: string; title: string; path: string; scope: string; clauses: string[]; schema: z.ZodType;
  read(db: D1Database, person: Person, args: any): Promise<unknown>;
}): ToolDefinition {
  return { name: spec.name, title: spec.title, description: spec.title, scope: spec.scope,
    clauses: spec.clauses, classes: ['standard'], readOnly: true, untrusted: true,
    inputSchema: nativeInputSchema(spec.schema), outputSchema: { type: 'object', additionalProperties: true },
    classify: () => [{ class: 'standard', facts: { measure: 1 } }],
    async run(raw, ctx) {
      let args;
      try { args = spec.schema.parse(raw); } catch (error) {
        if (error instanceof z.ZodError) throw new ToolRefusal('invalid_arguments');
        throw error;
      }
      return { result: await nativeRead(env, ctx.person, async db => {
        const grant = await actionAuthority(env.DB, ctx.person.id, 'GET', spec.path, {}, undefined);
        if (grant.decision !== 'allow') throw new ToolRefusal(grant.decision === 'hidden' ? 'not_found' : grant.decision);
        return spec.read(db, ctx.person, args);
      }) };
    },
  };
}
