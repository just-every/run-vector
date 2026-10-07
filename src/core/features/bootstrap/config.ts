import { z } from "zod";

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    // Intl accepts fixed offsets too; Vector requires a named IANA timezone.
    if (/^[+-]/.test(value)) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone, such as Australia/Brisbane.");

export type BootstrapEnvironment = {
  FIRST_OWNER_EMAIL?: string;
  FIRST_OWNER_NAME?: string;
  WORKSPACE_NAME?: string;
  WORKSPACE_TIMEZONE?: string;
  DEFAULT_TEAM_NAME?: string;
  DEFAULT_TEAM_PREFIX?: string;
};

const schema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(200),
  workspace: z.string().trim().min(1).max(200),
  timezone: timezoneSchema,
  team: z.string().trim().min(1).max(200),
  prefix: z.string().regex(/^[A-Z]{2,10}$/),
});

export function bootstrapConfig(env: BootstrapEnvironment) {
  return schema.parse({
    email: env.FIRST_OWNER_EMAIL,
    name: env.FIRST_OWNER_NAME,
    workspace: env.WORKSPACE_NAME,
    timezone: env.WORKSPACE_TIMEZONE,
    team: env.DEFAULT_TEAM_NAME,
    prefix: env.DEFAULT_TEAM_PREFIX,
  });
}

export class BootstrapConfigurationError extends Error {}
