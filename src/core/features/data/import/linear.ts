import type { ImportInput,ImportMapping } from './types';

// Linear's documented workspace CSV export. Private files, comments, and
// membership are absent; no account API or attachment URL fetch is involved.
export const linearMapping: ImportMapping = {
  sourceId:'ID',team:'Team',title:'Title',description:'Description',status:'Status',
  estimate:'Estimate',priority:'Priority',project:'Project',assignee:'Assignee',
  labels:'Labels',cycle:'Cycle Name',createdAt:'Created',updatedAt:'Updated',
  dueDate:'Due Date',parent:'Parent issue',archivedAt:'Archived',
};
/** Linear's CSV alone, or with the owner's API file merged by source ID. */
export const isLinear=(format:ImportInput['format'])=>format==='linear-csv'||format==='linear-api-json';
export function linearInput(input:ImportInput): ImportInput {
  return isLinear(input.format)?{...input,mapping:{...linearMapping,...input.mapping}}:input;
}
export function linearPriority(value:string):string {
  const priorities:Record<string,string>={'0':'none','1':'urgent','2':'high','3':'medium','4':'low','no priority':'none','none':'none','urgent':'urgent','high':'high','medium':'medium','low':'low'};
  return priorities[value.toLowerCase()] ?? value.toLowerCase();
}
