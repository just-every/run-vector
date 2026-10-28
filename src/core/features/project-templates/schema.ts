import {z} from 'zod';
const id=z.string().length(26),offset=z.number().int().min(-3650).max(3650).nullable();
export const templateInputSchema=z.object({name:z.string().trim().min(1).max(120),teamId:id.nullable().default(null),description:z.string().max(100000).default(''),cadence:z.string().trim().max(120).default(''),milestones:z.array(z.object({name:z.string().trim().min(1).max(120),description:z.string().max(100000).default(''),offsetDays:offset})).max(50).default([]),labels:z.array(z.string().trim().min(1).max(120)).max(50).default([]),issues:z.array(z.object({title:z.string().trim().min(1).max(500),description:z.string().max(100000).default(''),priority:z.enum(['urgent','high','medium','low','none']).default('none'),offsetDays:offset,startOffsetDays:offset.optional(),milestonePosition:z.number().int().min(0).max(49).nullable()})).max(100).default([])}).strict().refine(v=>v.issues.every(i=>i.milestonePosition===null||i.milestonePosition<v.milestones.length),{message:'Choose an existing milestone position.'});
export type TemplateInput=z.infer<typeof templateInputSchema>;
export type Template=TemplateInput&{id:string;version:number;canEdit:boolean};
export const captureSchema=z.object({name:z.string().trim().min(1).max(120),teamId:id.nullable(),referenceDate:z.iso.date(),cadence:z.string().trim().max(120).default('')}).strict();
export const applySchema=z.object({name:z.string().trim().min(1).max(120),startDate:z.iso.date(),teamId:id,expectedVersion:z.number().int().positive()}).strict();

export const templateSchema=templateInputSchema.and(z.object({id,version:z.number(),canEdit:z.boolean()}));
export const templateListSchema=z.object({templates:z.array(templateSchema),teams:z.array(z.object({id,name:z.string()})),workspaceAllowed:z.boolean()});
