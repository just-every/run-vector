import {z} from 'zod';
export const monthSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(v=>v>='0001-01'&&v<='9999-12');
export const calendarEventSchema=z.object({id:z.string(),kind:z.enum(['issue','cycle','milestone']),title:z.string(),start:z.string(),end:z.string(),allDay:z.boolean(),url:z.string(),updatedAt:z.string(),identifier:z.string().optional(),version:z.number().optional(),teamId:z.string().optional(),firstDay:z.string(),lastDay:z.string()});
export type MonthEvent=z.infer<typeof calendarEventSchema>;
export const monthCalendarSchema=z.object({canEdit:z.boolean(),month:monthSchema,today:z.string(),timezone:z.string(),events:z.array(calendarEventSchema)});
