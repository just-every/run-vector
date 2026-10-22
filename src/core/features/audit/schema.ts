import { z } from 'zod';

export const actorKinds = ['person', 'automation', 'integration', 'agent', 'unknown'] as const;
export const auditQuerySchema = z.object({
  through: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  actor: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(actorKinds).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
}).strict().refine(q => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), 'End time must be after start time.');
export type AuditQuery = z.infer<typeof auditQuerySchema>;
export const auditEntrySchema = z.object({
  id: z.string(), actorRef: z.string(), actorKind: z.enum(actorKinds),
  actorName: z.string().nullable(), action: z.string(), subjectRef: z.string(), at: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export const auditSchema = z.object({ entries: z.array(auditEntrySchema), through: z.number().int().nonnegative() });
export function auditSearch(query: Partial<Record<keyof AuditQuery, string>>) {
  return new URLSearchParams(Object.entries(query).filter(([, value]) => Boolean(value)) as [string, string][]).toString();
}
