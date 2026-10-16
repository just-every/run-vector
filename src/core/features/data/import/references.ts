import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import { ImportError,type ImportField,type ImportInput } from './types';
import { ownEntry,referenceAliasKey,referenceMatches } from './lookup';

export type ReferenceRow = Record<string,Json> & { id:string };
export type ImportReferences = Record<'teams'|'statuses'|'operators'|'projects'|'cycles'|'labels',ReferenceRow[]>;
export async function loadImportReferences(db:D1Database,workspace:string): Promise<ImportReferences> {
  const queries = {
    teams:'SELECT * FROM teams WHERE workspace_id=? ORDER BY name,id',
    statuses:'SELECT s.* FROM workflow_statuses s JOIN teams t ON t.id=s.team_id WHERE t.workspace_id=? ORDER BY s.name,s.id',
    operators:`SELECT o.*,EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=o.id AND a.status='active') AS identity_active FROM operators o WHERE workspace_id=? ORDER BY name,id`,
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
export function referenceAlias(input:ImportInput,field:ImportField,value:string,team?:string):string|undefined {
  const mapped=input.references?.[field];
  return ownEntry(mapped,referenceAliasKey(mapped,value,team));
}
export function resolveReference(rows:ReferenceRow[],value:string,field:ImportField,input:ImportInput,team?:string,defaultSelected=false): ReferenceRow {
  if(input.format==='jira-csv'&&field==='labels') {
    const row=rows.find(row=>row.name===value);
    if(!row)throw Error('Jira labels require an existing label with this exact name; no labels are created or guessed.');
    return row;
  }
  if(input.format==='jira-csv'&&['status','assignee','cycle'].includes(field)) {
    const id=referenceAlias(input,field,value,team)??(field==='status'&&defaultSelected&&input.defaults?.status===value?value:undefined);
    if(!id)throw Error('Reference was not found; choose an existing Vector value for this Jira name in the mapping controls below.');
    const row=rows.find(row=>row.id===id);
    if(!row||row.archived_at||row.removed_at||row.closed_at||(field==='assignee'&&!row.identity_active))throw Error('The mapped Vector value is unavailable. Choose an active team, status, operator, project or cycle.');
    if(field==='cycle'&&row.name!==value)throw Error('The Jira sprint and selected Vector cycle must have the same name.');
    return row;
  }
  const selected=referenceAlias(input,field,value,team)??value;
  const matches=referenceMatches(rows,selected,field==='assignee');
  if(matches.length!==1) throw Error(matches.length?'More than one Vector value matches. Choose the intended value in the mapping controls below.':'Reference was not found; choose an existing Vector value in the mapping controls or select a default below.');
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
