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

