import {z} from 'zod';

export const releaseNoteSource=z.object({
 id:z.string(),identifier:z.string(),title:z.string(),
 projectId:z.string().nullable(),projectName:z.string().nullable(),
});
export const generateReleaseNotes=z.object({expectedReleaseVersion:z.number().int().positive()}).strict();
export const editReleaseNotes=generateReleaseNotes.extend({
 expectedVersion:z.number().int().positive(),body:z.string().max(100000),
}).strict();
export const releaseNoteDraft=z.object({
 releaseId:z.string(),ownerOperatorId:z.string(),body:z.string(),
 sources:z.array(releaseNoteSource),sourceReleaseVersion:z.number(),version:z.number(),
 authorOperatorId:z.string(),createdAt:z.string(),updatedAt:z.string(),
});
export const releaseNotesResult=z.object({
 draft:releaseNoteDraft.nullable(),canEdit:z.boolean(),releaseChanged:z.boolean(),
});
export type NoteSource=z.infer<typeof releaseNoteSource>;
export type NoteDraft=z.infer<typeof releaseNoteDraft>;
