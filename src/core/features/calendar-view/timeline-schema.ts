import {z} from 'zod';
import {issueListSchema} from '../issues/list-schema';

export const timelineSchema=issueListSchema.extend({
  today:z.string().date(),
  timezone:z.string(),
  canEdit:z.boolean(),
  dependencies:z.array(z.object({blocking:z.string(),blocked:z.string()})),
});
export type TimelineData=z.infer<typeof timelineSchema>;
export type TimelineIssue=TimelineData['issues'][number];
