import { z } from "zod";

// Unicode's recommended emoji sequences include skin tones, flags, keycaps,
// and joined families, while excluding prose and unrelated grapheme clusters.
const singleEmoji = new RegExp("^\\p{RGI_Emoji}$", "v");

export const reactionInputSchema = z.object({
  subjectId: z.union([
    z.literal("description"),
    z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
  ]),
  emoji: z.string().max(128).refine((value) => singleEmoji.test(value), {
    message: "Choose one emoji.",
  }),
}).strict();

export const reactionProjectionSchema = z.object({
  canReact: z.boolean(),
  reactions: z.array(z.object({
    subjectId: z.string(),
    emoji: z.string(),
    count: z.number().int().positive(),
    reacted: z.boolean(),
    people: z.array(z.object({ id: z.string(), name: z.string() })),
  })),
});

export type ReactionInput = z.infer<typeof reactionInputSchema>;
export type ReactionProjection = z.infer<typeof reactionProjectionSchema>;
