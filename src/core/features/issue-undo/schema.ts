import { z } from "zod";
import { identityFields, snapshotFields } from "./snapshot";
const text = z.string().nullable();
export const issueSnapshotSchema = z.object({
  id: z.string(), identifier: z.string(), version: z.number().int().positive(),
  teamId: z.string(), statusId: z.string(), statusCategory: z.string(),
  title: z.string().optional(), description: z.string().optional(), priority: z.string().optional(),
  assigneeOperatorId: text.optional(), projectId: text.optional(), milestoneId: text.optional(), cycleId: text.optional(),
  startDate: text.optional(), dueDate: text.optional(), estimate: z.number().nullable().optional(), expectedOutcome: text.optional(),
  customerImpact: text.optional(), customFields: z.json().optional(), completedAt: text.optional(),
  canceledAt: text.optional(), archivedAt: text.optional(), deferredUntil: text.optional(), labelIds: z.array(z.string()).optional(),
  deferralOrigin: text.optional(), canonicalId: text.optional(), canonicalIdentifier: text.optional(),
  canonicalCreatedAt: text.optional(),
});
export type IssueSnapshot = z.output<typeof issueSnapshotSchema>;
export const fieldSchema = z.enum(snapshotFields);
export const undoActionSchema = z.object({
  actionId: z.string(), workspaceId: z.string(), sessionHash: z.string(),
  kind: z.enum(["property", "team", "duplicate"]), expiresAt: z.string().datetime(),
  fields: z.array(fieldSchema).min(identityFields.length),
  before: z.array(issueSnapshotSchema).min(1), after: z.array(issueSnapshotSchema).min(1),
  postVersions: z.array(z.object({ identifier: z.string(), version: z.number().int().positive() })).default([]),
  graph: z.array(z.object({ issueId: z.string(), canonicalId: z.string(), createdAt: z.string() })),
}).superRefine((action, context) => {
  if (new Set(action.fields).size !== action.fields.length || identityFields.some((field) => !action.fields.includes(field)) ||
      action.before.length !== action.after.length || new Set(action.before.map((row) => row.id)).size !== action.before.length ||
      action.before.some((before, index) => {
        const after = action.after[index];
        return !after || before.id !== after.id || before.identifier !== after.identifier || after.version !== (action.postVersions.find(row => row.identifier === before.identifier)?.version ?? before.version + 1) || ![1, 2].includes(after.version - before.version) ||
          action.fields.some((field) => !(field in before) || !(field in after));
      })) context.addIssue({ code: "custom", message: "Undo membership is invalid." });
});
export type UndoAction = z.output<typeof undoActionSchema>;
export type UndoReceipt = { actionId: string; expiresAt: number; identifiers: string[] };
export type UndoFailure = { identifier: string; reasons: string[] };
export class UndoError extends Error {
  constructor(readonly code: string, message: string, readonly status: 409 | 410, readonly failures: UndoFailure[] = []) {
    super(message);
  }
}
