import type { z } from 'zod';
import { importFieldLabel } from './field-labels';
import type { ImportDiagnostic } from './types';

const inputFields:Record<string,string>={teamId:'team',statusId:'status',assigneeOperatorId:'assignee',projectId:'project',cycleId:'cycle',labelIds:'labels'};

/** Schema validation is a final safety check; its internal names and messages
 * are never an instruction for someone mapping an export. */
export function importValidationErrors(issues:z.core.$ZodIssue[],row:number,existing:ImportDiagnostic[]):ImportDiagnostic[] {
  const result:ImportDiagnostic[]=[];
  for(const issue of issues){
    const key=String(issue.path[0]),field=inputFields[key]??key;
    if(existing.some(error=>error.field===field)||result.some(error=>error.field===field))continue;
    const label=importFieldLabel(field);
    let message:string;
    if(field==='title')message='Provide a title of 1 to 500 characters in the selected column.';
    else if(['team','status','assignee','project','cycle'].includes(field))message=`Choose an existing ${label.toLowerCase()} using the mapping controls or a default.`;
    else if(field==='labels')message=issue.code==='too_big'?`Use at most ${issue.maximum} labels for one issue.`:'Choose existing labels without repeats.';
    else if(issue.code==='too_big')message=`Use at most ${issue.maximum} characters for ${label.toLowerCase()}.`;
    else message=`Check the ${label.toLowerCase()} value in this row.`;
    result.push({row,field,code:'invalid_native_field',message});
  }
  return result;
}
