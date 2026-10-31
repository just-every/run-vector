import {z} from "zod";
export const defaultIssueTemplateSchema=z.object({
  name:z.string().trim().min(1).max(120),
  title:z.string().max(500).default(""),
  description:z.string().max(100000).default(""),
  priority:z.enum(["none","low","medium","high","urgent"]).default("none"),
  estimate:z.number().int().min(1).max(100).nullable().default(null),
  labelIds:z.array(z.string().length(26)).max(100).default([]).refine(ids=>new Set(ids).size===ids.length),
}).strict();
export type DefaultIssueTemplate=z.infer<typeof defaultIssueTemplateSchema>;
