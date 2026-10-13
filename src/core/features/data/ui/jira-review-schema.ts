import { z } from 'zod';
const diagnostic=z.object({row:z.number(),column:z.number().optional(),field:z.string().optional(),code:z.string(),message:z.string(),sourceId:z.string(),sourceKey:z.string(),value:z.string()});
const confirmation=z.object({source:z.string(),rows:z.array(z.number()),categories:z.array(z.string()),suggestion:z.string().nullable(),target:z.string().nullable()});
export const jiraReviewSchema=z.object({
 policies:z.array(z.string()),statuses:z.array(confirmation),priorities:z.array(confirmation),unresolved:z.array(diagnostic),
 concepts:z.array(z.object({name:z.string(),headers:z.array(z.object({name:z.string(),column:z.number()})),action:z.string(),rowCount:z.number(),rows:z.array(z.number()),valueCount:z.number(),values:z.array(z.object({value:z.string(),count:z.number(),rows:z.array(z.number())})),dispositions:z.array(z.object({action:z.enum(['planned','not_imported','error','review_only']),reason:z.string(),rows:z.array(z.number()),rowCount:z.number(),valueCount:z.number()})),occurrences:z.array(z.object({row:z.number(),sourceId:z.string(),sourceKey:z.string(),column:z.number(),value:z.string(),action:z.enum(['planned','not_imported','error','review_only']),reason:z.string(),metadata:z.object({time:z.string(),author:z.string(),body:z.string().optional(),filename:z.string().optional(),url:z.string().optional()}).optional()}))})),
});
