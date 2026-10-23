import { z } from "zod";
const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const feedInputSchema = z.object({ teamId: id.nullable().default(null) }).strict();
export const feedChangeSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const feedSchema = z.object({
  id, teamId: id.nullable(), teamName: z.string().nullable(), creatorId: id,
  version: z.number(), createdAt: z.string(), updatedAt: z.string(), revokedAt: z.string().nullable(),
  canRotate: z.boolean(), canRevoke: z.boolean(),
});
export const feedListSchema = z.object({
  feeds: z.array(feedSchema),
  teams: z.array(z.object({ id, name: z.string() })),
});
export const feedReceiptSchema = z.object({ id, url: z.string().url(), version: z.number() });
export type CalendarEvent = {
  id: string; kind: "issue" | "cycle" | "milestone"; title: string;
  start: string; end: string; allDay: boolean; url: string; updatedAt: string;
  identifier?: string; version?: number; teamId?: string;
};
