import type { Json,SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';
import { ImportError,type ImportDiagnostic,type ImportInput } from './types';
import { hulyMapping,hulyOmission,prepareHuly } from './huly';
import { planeMapping,planeOmission,preparePlane } from './plane';
import { shortcutMapping,shortcutOmission,prepareShortcut } from './shortcut';
import { profileNonempty,profilePayloadKey,profileText } from './profile-values';

export const isProfile=(format:string):boolean=>['plane-csv','huly-json','shortcut-csv'].includes(format);
export function profileInput(input:ImportInput):ImportInput {
  if(!isProfile(input.format))return input;
  if(Object.keys(input.mapping).length)throw new ImportError(400,'profile_fixed_columns','This source profile uses fixed named columns. Use defaults and reviewed reference mappings instead of manual column mappings.');
  if(Object.keys(input.defaults??{}).some(field=>!['team','status','project'].includes(field)))throw new ImportError(400,'profile_invalid_default','Source profiles accept only default team, status and project. Other missing or omitted values are not replaced.');
  if(input.format!=='shortcut-csv'&&!input.defaults?.team?.trim())throw new ImportError(400,'profile_team_required','Plane and Huly require an explicit default Vector team. A source project is not a team.');
  const mapping=input.format==='plane-csv'?planeMapping:input.format==='huly-json'?hulyMapping:shortcutMapping;
  return {...input,mapping:{...mapping}};
}
export function prepareProfile(input:ImportInput,payload:Record<string,Json>,row:number):{payload:Record<string,Json>;errors:ImportDiagnostic[]} {
  if(input.format==='plane-csv')return preparePlane(payload,row);
  if(input.format==='huly-json')return prepareHuly(payload,row);
  if(input.format==='shortcut-csv')return prepareShortcut(payload,row);
  return {payload,errors:[]};
}
export function profileOmissions(record:SourceRecord,input:ImportInput):ImportDiagnostic[] {
  if(!isProfile(input.format)||!record.payload||typeof record.payload!=='object'||Array.isArray(record.payload))return [];
  const payload=record.payload as Record<string,Json>,stored=payload[profilePayloadKey],row=record.location.row!,sourceId=record.sourceId;
  const omissions=(Array.isArray(stored)?stored as unknown as ImportDiagnostic[]:[]).map(item=>({...item,row,sourceId}));
  const used=new Set(Object.values(input.mapping));
  for(const [field,value] of Object.entries(payload))if(field!==profilePayloadKey&&!used.has(field)&&profileNonempty(value)) {
    const reason=input.format==='plane-csv'?planeOmission(field):input.format==='huly-json'?hulyOmission(field):shortcutOmission(field);
    omissions.push({row,field,sourceId,value:profileText(value),...(reason??{code:'profile_unmapped_column',message:'This source field has no mapped Vector field. Its value is retained in the original file.'})});
  }
  return omissions;
}
