import { z } from "zod";

export const themeChoiceSchema = z.enum(["light", "dark", "system"]);
export const appearanceSchema = z.object({ theme: themeChoiceSchema }).strict();
export type ThemeChoice = z.infer<typeof themeChoiceSchema>;
