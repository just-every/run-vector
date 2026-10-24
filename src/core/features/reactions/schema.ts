import { z } from 'zod';
export const emojis = ['👍', '❤️', '🎉', '👀', '🚀', '👎'] as const;
export const reactionInput = z.object({ targetId: z.union([z.literal(''), z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)]), emoji: z.enum(emojis) }).strict();
export const reactionsSchema = z.object({ reactions: z.array(z.object({ targetId: z.string(), emoji: z.enum(emojis), actorId: z.string(), actor: z.string(), own: z.boolean() })) });
