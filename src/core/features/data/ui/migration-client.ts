import { z } from 'zod';
const reference=z.object({id:z.string(),runId:z.string(),row:z.number(),sourceId:z.string(),targetSourceId:z.string(),kind:z.string(),state:z.enum(['pending','omitted'])});
export const migrationsSchema=z.object({migrations:z.array(z.object({id:z.string(),source:z.string(),state:z.enum(['open','finished']),version:z.number()}))});
export const migrationSchema=z.object({
  migration:z.object({id:z.string(),source:z.string(),state:z.enum(['open','finished']),version:z.number(),finishedAt:z.string().nullable()}),
  runs:z.array(z.object({id:z.string(),state:z.string(),total:z.number(),checkpoint:z.number()})),
  pending:z.array(reference),omissions:z.array(reference),totals:z.object({rowsRead:z.number(),issuesWritten:z.number()}),
});
export type MigrationReport=z.infer<typeof migrationSchema>;
export type MigrationSelection={id:string;source:string};
