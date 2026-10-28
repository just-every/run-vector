import { z } from 'zod';
import { ToolRefusal, type ClassAndFacts, type JsonSchemaObject, type Person, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { actionAuthority } from '../roles/enforcement';
import { nativeRead } from './reads.ts';

export const workspaceStandard = (): ClassAndFacts[] => [{ class: 'standard', facts: { measure: 1 } }];
export const workspaceEmpty = z.object({}).strict();
export const notificationId = z.string().regex(/^[a-f0-9]{32}$/);

/** A read uses the native projection, current person and current visibility.
 * Registered read doors retain their role-matrix decision as well. */
export function workspaceRead(env: WorkerBindings, spec: {
  name: string; title: string; scope: string; clauses: string[]; schema: z.ZodType;
  read(db: D1Database, person: Person, args: any): Promise<unknown>;
  path?: string; params?(args: any): Record<string, string>; uri?(args: any): string;
}): ToolDefinition {
  return {
    name: `vector.${spec.name}`, title: spec.title, description: spec.title, scope: spec.scope,
    readOnly: true, untrusted: true, classes: ['standard'], clauses: spec.clauses,
    inputSchema: z.toJSONSchema(spec.schema, { io: 'input', unrepresentable: 'any' }) as JsonSchemaObject,
    outputSchema: { type: 'object', additionalProperties: true }, classify: workspaceStandard,
    async run(args, ctx) {
      const parsed = spec.schema.parse(args);
      const result = await nativeRead(env, ctx.person, async db => {
        if (spec.path) await workspaceReadAuthority(db, ctx.person, spec.path, spec.params?.(parsed));
        return spec.read(db, ctx.person, parsed);
      });
      return { result, ...(spec.uri ? { resources: [{ uri: spec.uri(parsed), name: spec.title }] } : {}) };
    },
  };
}

export async function workspaceReadAuthority(db: D1Database, person: Person, path: string, params: Record<string, string> = {}) {
  const result = await actionAuthority(db, person.id, 'GET', path, params, undefined);
  if (result.decision !== 'allow') throw new ToolRefusal(result.decision === 'hidden' ? 'not_found' : result.decision);
}

/** This is the inbox's same owned, issue-scoped record projection, including
 * snooze state. A missing record and a withdrawn issue both yield not_found. */
export async function workspaceNotification(db: D1Database, person: Person, id: string) {
  const row = await db.prepare(`SELECT n.id,n.event_id eventId,i.identifier,i.title,n.actor_name actor,
    n.causes_json causesJson,n.created_at createdAt,n.read_at readAt,
    s.until_at snoozedUntil,s.until_change snoozeOnChange,s.returned_at returnedAt,
    COALESCE(s.returned_at,n.created_at) visibleAt
    FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN teams t ON t.id=i.team_id
    JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
    LEFT JOIN notification_snoozes s ON s.notification_id=n.id
    WHERE n.id=? AND n.recipient_id=?`).bind(id, person.id)
    .first<{ causesJson: string; snoozeOnChange: number | null } & Record<string, unknown>>();
  if (!row) throw new ToolRefusal('not_found');
  const { causesJson, snoozeOnChange, ...record } = row;
  return { ...record, causes: JSON.parse(causesJson), snoozeOnChange: Boolean(snoozeOnChange) };
}

export async function workspaceReminder(db: D1Database, person: Person, id: string) {
  const row = await db.prepare(`SELECT r.id,i.identifier,r.remind_at remindAt,r.created_at createdAt,
    r.delivered_at deliveredAt FROM issue_reminders r JOIN issues i ON i.id=r.issue_id
    JOIN teams t ON t.id=i.team_id JOIN operators o ON o.id=r.recipient_id AND o.workspace_id=t.workspace_id
    WHERE r.id=? AND r.recipient_id=?`).bind(id, person.id).first<Record<string, unknown>>();
  if (!row) throw new ToolRefusal('not_found');
  return row;
}
