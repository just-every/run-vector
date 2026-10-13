import { z } from "zod";
import { issueListQuerySchema } from "../issues/list-schema";

export const viewIdSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const name = z.string().trim().min(1).max(120);
const layout = z.enum(["list", "board"]);
export const savedViewSchema = z.object({
  id: viewIdSchema,
  name: z.string().min(1),
  ownerOperatorId: viewIdSchema,
  isShared: z.boolean(),
  layout,
  query: issueListQuerySchema,
});
export type SavedView = z.output<typeof savedViewSchema>;
export const createViewSchema = z
  .object({
    name,
    isShared: z.boolean().default(false),
    layout: layout.default("list"),
    query: issueListQuerySchema,
  })
  .strict();
export const updateViewSchema = z
  .object({
    name: name.optional(),
    isShared: z.boolean().optional(),
    layout: layout.optional(),
    query: issueListQuerySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const duplicateViewSchema = z.object({ name }).strict();
export const preferenceSurfaceSchema = z.enum([
  "issues",
  "board",
  "current",
  "my-work",
  "projects",
]);
export type PreferenceSurface = z.output<typeof preferenceSurfaceSchema>;
export const preferenceSchema = z.object({
  surface: preferenceSurfaceSchema,
  filters: z.record(z.string(), z.json()),
  sort: z.string(),
  grouping: z.string(),
});
export type ListPreference = z.output<typeof preferenceSchema>;
export const preferenceInputSchema = z
  .object({
    filters: z.record(z.string(), z.json()),
    sort: z.string().optional(),
    grouping: z.string().optional(),
  })
  .strict();
