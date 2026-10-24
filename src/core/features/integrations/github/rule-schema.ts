import {z} from 'zod';

export const gitTriggers=['draft','review','merged','deploy'] as const;
export const gitRuleSchema=z.object({
 trigger:z.enum(gitTriggers),
 statusId:z.string().nullable(),
 allowReopen:z.number(),
 version:z.number(),
 environment:z.string(),
});
export type GitRule=z.infer<typeof gitRuleSchema>;
export type GitTrigger=GitRule['trigger'];
