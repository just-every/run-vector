import { z } from "zod";

export const issueIdentifier = z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
export const linkId = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

/** HTTPS navigation; video previews separately require a fixed provider allowlist. */
export function isSafeHttpsUrl(value: string): boolean {
  if (
    !/^https:\/\//i.test(value) ||
    /[\u0000-\u0020\u007f-\u009f\\]/u.test(value)
  )
    return false;
  try {
    if (/[\u0000-\u0020\u007f-\u009f\\]/u.test(decodeURIComponent(value)))
      return false;
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const createLinkSchema = z
  .object({
    name: z
      .string()
      .max(200)
      .refine(
        (name) => !/[\u0000-\u001f\u007f-\u009f]/u.test(name),
        "Name must not contain control characters.",
      )
      .trim()
      .min(1),
    url: z
      .string()
      .max(2000)
      .refine(
        isSafeHttpsUrl,
        "A HTTPS URL without credentials or control characters is required.",
      )
      .transform((value) => new URL(value).href),
    commentId: linkId.optional(),
  })
  .strict();

export const namedLinksSchema = z.object({
  links: z.array(
    z.object({
      id: linkId,
      name: z.string(),
      url: z.string().refine(isSafeHttpsUrl),
      commentId: linkId.nullable(),
      actor: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export type NamedLink = z.infer<typeof namedLinksSchema>["links"][number];
