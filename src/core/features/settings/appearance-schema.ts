import { z } from "zod";

export const themeChoiceSchema = z.enum(["light", "dark", "system"]);
export const displayNameSchema = z.string().trim().min(1).max(120).refine(name => !/[\x00-\x1f\x7f]/.test(name));
export const appearanceSchema = z.object({ theme: themeChoiceSchema, displayName: z.string().optional() }).strict();
export const appearanceInputSchema = z.object({ theme: themeChoiceSchema.optional(), displayName: displayNameSchema.optional() }).strict()
  .refine(input => input.theme !== undefined || input.displayName !== undefined);
export type ThemeChoice = z.infer<typeof themeChoiceSchema>;
