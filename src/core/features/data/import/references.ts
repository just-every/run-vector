import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import { ImportError,type ImportField,type ImportInput } from './types';

export type ReferenceRow = Record<string,Json> & { id:string };
export type ImportReferences = Record<'teams'|'statuses'|'operators'|'projects'|'cycles'|'labels',ReferenceRow[]>;
export async function loadImportReferences(db:D1Database,workspace:string): Promise<ImportReferences> {
  const queries = {
    teams:'SELECT * FROM teams WHERE workspace_id=? ORDER BY name,id',
    statuses:'SELECT s.* FROM workflow_statuses s JOIN teams t ON t.id=s.team_id WHERE t.workspace_id=? ORDER BY s.name,s.id',
    operators:'SELECT * FROM operators WHERE workspace_id=? ORDER BY name,id',
    projects:'SELECT * FROM projects WHERE workspace_id=? ORDER BY name,id',
    cycles:'SELECT c.* FROM cycles c JOIN teams t ON t.id=c.team_id WHERE t.workspace_id=? ORDER BY c.name,c.id',
    labels:'SELECT * FROM labels WHERE workspace_id=? ORDER BY name,id',
  };
  const entries=await Promise.all(Object.entries(queries).map(async([name,query])=>{
    const rows=(await db.prepare(query+' LIMIT 5001').bind(workspace).all<ReferenceRow>()).results;
    if (rows.length>5000) throw new ImportError(413,'import_metadata_limit','A reference category exceeds the supported 5,000-record lookup bound.');
    return [name,rows];
  }));
  return Object.fromEntries(entries) as ImportReferences;
}
/** An explicit mapping wins: `Team/Name` for a team's own status or cycle, then
 * the bare name. Otherwise an exact name, then one case-insensitive name match. */
export function resolveReference(rows:ReferenceRow[],value:string,field:ImportField,input:ImportInput,team?:string,defaultSelected=false): ReferenceRow {
  const mapped=input.references?.[field];
  if(input.format==='jira-csv'&&['status','assignee','cycle'].includes(field)) {
    const id=(team!==undefined?mapped?.[team+'/'+value]:undefined)??mapped?.[value]??(field==='status'&&defaultSelected&&input.defaults?.status===value?value:undefined);
    if(!id)throw Error('Reference was not found; confirm an explicit Jira mapping to an active native record.');
    const row=rows.find(row=>row.id===id);
    if(!row||row.archived_at||row.removed_at||row.closed_at)throw Error('The explicitly mapped native record is missing, archived, removed or closed.');
    if(field==='cycle'&&row.name!==value)throw Error('Jira sprint mapping requires the exact native cycle name.');
    return row;
  }
  const selected=(team!==undefined?mapped?.[team+'/'+value]:undefined) ?? mapped?.[value] ?? value;
  let matches=rows.filter(row=>row.id===selected || row.name===selected || (field==='assignee' && row.email===selected));
  if(!matches.length)matches=rows.filter(row=>typeof row.name==='string' && row.name.toLowerCase()===selected.toLowerCase());
  if(matches.length!==1) throw Error(matches.length?'Reference is ambiguous; map it to a native ID.':'Reference was not found; choose an existing native record.');
  const row=matches[0];
  if(row.archived_at || row.removed_at || row.closed_at) throw Error('The selected record is archived, removed or closed.');
  return row;
}
export function importField(input:ImportInput,payload:Record<string,Json>,field:ImportField): Json|undefined {
  const column=input.mapping[field];
  const value=column?payload[column]:undefined;
  return value === undefined || value === '' || value === null ? input.defaults?.[field] : value;
}
export function stringField(value:Json|undefined,label:string,max=20000):string {
  if(value===undefined || value===null)return '';
  if(typeof value!=='string' || value.length>max)throw Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
export function listField(value:Json|undefined,label:string):string[] {
  if(value===undefined || value===null || value==='')return [];
  const parts=Array.isArray(value)?value:typeof value==='string'?value.split(','):null;
  if(!parts || parts.some(part=>typeof part!=='string'))throw Error(`${label} must be a comma-separated list or an array of text.`);
  const result=(parts as string[]).map(part=>part.trim());
  if(result.some(part=>!part) || new Set(result).size!==result.length)throw Error(`${label} contains an empty or duplicate reference.`);
  return result;
}
