import {
  cycleSnapshotSchema,
  cycleFailureSchema,
  cycleProgressSchema,
} from "../cycle-closure/schema.ts";
import { z } from "zod";
import { cycleReportSchema } from "../cycle-report/schema.ts";

export const administrationId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const workflowCategory = z.enum([
  "intake",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "duplicate",
]);
const name = z.string().trim().min(1).max(120);
const prefix = z
  .string()
  .regex(/^[A-Z]{2,10}$/, "Use 2–10 uppercase ASCII letters.");
export const labelColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hexadecimal colour.");
export function labelTextColor(color: string): "#000000" | "#ffffff" {
  const valid = labelColor.parse(color);
  const channels = [1, 3, 5]
    .map((offset) => parseInt(valid.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
export const teamCreateSchema = z
  .object({ name, identifierPrefix: prefix })
  .strict();
export const teamUpdateSchema = teamCreateSchema
  .partial()
  .extend({ archived: z.boolean().optional(), autoCycleStarted: z.boolean().optional(), autoCycleCompleted: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const statusCreateSchema = z
  .object({ name, category: workflowCategory })
  .strict();
export const statusRenameSchema = z.object({ name }).strict();
export const statusReorderSchema = z
  .object({
    statusIds: z
      .array(administrationId)
      .min(7)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export const statusRemoveSchema = z
  .object({ destinationStatusId: administrationId })
  .strict();
export const labelCreateSchema = z.object({ name, color: labelColor, projectsEnabled: z.boolean().default(false) }).strict();
export const labelUpdateSchema = labelCreateSchema
  .partial()
  .extend({ projectsEnabled: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const projectPriority = z.enum(["urgent", "high", "medium", "low", "none"]);
export const projectLabelIds = z.array(administrationId).max(100).refine(ids => new Set(ids).size === ids.length, "Choose each label once.");
export const projectCreateSchema = z
  .object({
    name,
    description: z.string().max(100000).default(""),
    leadOperatorId: administrationId,
    startDate: z.string().date().nullable().default(null),
    targetDate: z.string().date().nullable().default(null),
    priority: projectPriority.default("none"),
    labelIds: projectLabelIds.default([]),
  })
  .strict();
export const projectUpdateSchema = projectCreateSchema
  .partial()
  .extend({
    description: projectCreateSchema.shape.description.removeDefault().optional(),
    startDate: projectCreateSchema.shape.startDate.removeDefault().optional(),
    targetDate: projectCreateSchema.shape.targetDate.removeDefault().optional(),
    priority: projectPriority.optional(),
    labelIds: projectLabelIds.optional(),
    lifecycle: z
      .enum(["planned", "active", "completed", "canceled"])
      .optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const cycleCreateSchema = z
  .object({
    teamId: administrationId,
    name,
    startsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    endsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    capacity: z.number().int().nonnegative().nullable().default(null),
  })
  .strict();
export const cycleScheduleSchema = z.object({
  weeks: z.number().int().min(1).max(8),
  startWeekday: z.number().int().min(0).max(6),
  cooldownWeeks: z.number().int().min(0).max(8),
  upcomingCount: z.number().int().min(1).max(24),
}).strict();
export const administrationStatusSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  category: workflowCategory,
  position: z.number(),
});
export const administrationCycleSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().nullable(),
  closedAt: z.string().nullable(),
});
export const administrationSchema = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
  }),
  cycleSchedules: z.array(cycleScheduleSchema.extend({teamId: z.string()})),
  labelsPerIssue: z.number(),
  teams: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      identifierPrefix: z.string(),
      archivedAt: z.string().nullable(),
      prefixEditable: z.boolean(),
      autoCycleStarted: z.boolean(),
      autoCycleCompleted: z.boolean(),
      statuses: z.array(administrationStatusSchema),
    }),
  ),
  labels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
      textColor: z.string(),
      projectsEnabled: z.boolean(),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      leadOperatorId: z.string(),
      startDate: z.string().nullable(),
      targetDate: z.string().nullable(),
      priority: projectPriority,
      labelIds: z.array(z.string()),
      lifecycle: z.enum(["planned", "active", "completed", "canceled"]),
      archivedAt: z.string().nullable(),
    }),
  ),
  operators: z.array(z.object({ id: z.string(), name: z.string() })),
  cycles: z.array(administrationCycleSchema),
});
export const cycleDetailSchema = z.object({
  report: cycleReportSchema,
  cycle: administrationCycleSchema,
  workspaceTimezone: z.string(),
  issues: z.array(
    z.object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
      version: z.number(),
      teamId: z.string(),
      statusId: z.string(),
      category: workflowCategory,
      estimate: z.number().nullable(),
      cycleId: z.string(),
    }),
  ),
  snapshot: cycleSnapshotSchema.nullable(),
  failure: cycleFailureSchema.nullable(),
  progress: cycleProgressSchema,
});
export type Administration = z.infer<typeof administrationSchema>;
export type CycleDetail = z.infer<typeof cycleDetailSchema>;
