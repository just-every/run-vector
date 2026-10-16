import type { ImportField } from './types';

export const importFieldNames: Record<ImportField,string> = {
  sourceId:'Original issue ID',title:'Title',description:'Description',team:'Team',status:'Status',priority:'Priority',assignee:'Assignee',project:'Project',cycle:'Cycle',labels:'Labels',estimate:'Estimate',dueDate:'Due date',expectedOutcome:'Expected outcome',customerImpact:'Customer impact',createdAt:'Created at',updatedAt:'Updated at',parent:'Parent',dependencies:'Dependencies',duplicateOf:'Duplicate of',archivedAt:'Archived at',
};

export function importFieldLabel(field:string):string {
  return Object.hasOwn(importFieldNames,field)?importFieldNames[field as ImportField]:field;
}
