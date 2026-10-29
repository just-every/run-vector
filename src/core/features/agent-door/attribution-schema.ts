import { z } from 'zod';

const reference = z.object({ id: z.string(), name: z.string() });
/** Historical attribution returned beside a native timeline entry. */
export const storedAttributionSchema = z.object({
  agent: reference,
  person: reference,
  consent: z.string().nullable(),
  approvers: z.array(reference),
  label: z.string(),
});
