import { z } from 'zod';
import { administrationId } from '../administration/schema';
import { listProjectSummaries, type ProjectSummary } from './service';
import type { WorkspaceSnapshot } from '../streams';

export const projectPortfolioQuery = z.object({
  at: z.string().datetime({offset:true}).optional(),
  includeArchived: z.enum(['true','false']).default('false'),
  lifecycle: z.enum(['all','planned','active','completed','canceled']).default('all'),
  health: z.enum(['all','blocked','at-risk','on-track','unknown']).default('all'),
  label: z.union([z.literal('all'),administrationId]).default('all'),
  sort: z.enum(['newest','priority']).default('newest'),
  lead: z.union([z.literal('all'),administrationId]).default('all'),
  team: z.union([z.literal('all'),administrationId]).default('all'),
  targetFrom: z.union([z.literal(''),z.string().date()]).default(''),
  targetTo: z.union([z.literal(''),z.string().date()]).default(''),
}).strict().refine(query=>!query.targetFrom||!query.targetTo||query.targetFrom<=query.targetTo,{message:'Target date range must end on or after it starts.',path:['targetTo']});
export type ProjectPortfolioQuery = z.output<typeof projectPortfolioQuery>;
export function selectPortfolio(projects: ProjectSummary[], query: Pick<ProjectPortfolioQuery,'lifecycle'|'health'|'label'|'sort'|'lead'|'team'|'targetFrom'|'targetTo'>) {
  return projects.filter(project =>
    (query.lifecycle === 'all' || project.lifecycle === query.lifecycle) &&
    (query.health === 'all' || project.health === query.health) &&
    (query.label === 'all' || project.labels.some(label => label.id === query.label)) &&
    (query.lead === 'all' || project.lead.id === query.lead) &&
    (query.team === 'all' || project.teamIds.includes(query.team)) &&
    (!query.targetFrom || (project.targetDate !== null && project.targetDate >= query.targetFrom)) &&
    (!query.targetTo || (project.targetDate !== null && project.targetDate <= query.targetTo)))
    .sort((a,b) => (query.sort === 'priority' ? priorities.indexOf(a.priority)-priorities.indexOf(b.priority) : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
const priorities = ['urgent','high','medium','low','none'];
export function portfolioCounts(projects: ProjectSummary[]) {
  return projects.reduce<Record<string,number>>((counts,project) => {
    if(project.health !== 'none') counts[project.health]=(counts[project.health]??0)+1;
    counts[project.lifecycle]=(counts[project.lifecycle]??0)+1;
    return counts;
  },{});
}
export function readPortfolio(snapshot: WorkspaceSnapshot, query: ProjectPortfolioQuery) {
  const now = query.at ? new Date(query.at) : new Date();
  const projects = selectPortfolio(listProjectSummaries(snapshot,now,query.includeArchived==='true'),query);
  return {generatedAt:now.toISOString(), counts:portfolioCounts(projects), projects};
}
