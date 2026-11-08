import {z} from 'zod';
import {projectUpdateSchema} from '../administration/schema';
export const roadmapChange = z.object({
  startDate:projectUpdateSchema.shape.startDate,targetDate:projectUpdateSchema.shape.targetDate,
  priority:projectUpdateSchema.shape.priority,labelIds:projectUpdateSchema.shape.labelIds,
  expectedVersion:z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine(value => Object.keys(value).length > 1, 'Choose a field to change.');
export const placementSchema = z.object({kind:z.enum(['interval','diamond','open','unscheduled']),start:z.string().nullable(),end:z.string().nullable()});
export const roadmapProjectSchema = z.object({
  id:z.string(),name:z.string(),startDate:z.string().nullable(),targetDate:z.string().nullable(),
  lifecycle:z.enum(['planned','active','completed','canceled']),priority:z.enum(['none','low','medium','high','urgent']),
  labelIds:z.array(z.string()),version:z.string(),placement:placementSchema,
  milestones:z.array(z.object({id:z.string(),name:z.string(),targetDate:z.string().nullable(),completed:z.boolean()})),
});
export const roadmapSchema = z.object({
  today:z.string(),timezone:z.string(),canEdit:z.boolean(),projects:z.array(roadmapProjectSchema),
  labels:z.array(z.object({id:z.string(),name:z.string()})),
  initiatives:z.array(z.object({id:z.string(),name:z.string(),projectIds:z.array(z.string()),placement:placementSchema})),
});
export type RoadmapData = z.infer<typeof roadmapSchema>;
export type RoadmapProject = z.infer<typeof roadmapProjectSchema>;
export type Placement = z.infer<typeof placementSchema>;
