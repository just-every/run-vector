import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { ImportMapping } from './types';
import { profileCalendar,profileNonempty,profileRow } from './profile-values';

export const planeMapping:ImportMapping={sourceId:'ID',title:'Name',description:'Description',status:'State',priority:'Priority',project:'Project',assignee:'Assignees',labels:'Labels',estimate:'Estimate',startDate:'Start Date',dueDate:'Target Date',parent:'Parent',cycle:'Cycle Name'};
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function planeDate(value:Json):string|null {
  if(typeof value!=='string')return null;
  const match=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/.exec(value);
  if(!match)return null;
  const date=`${match[4]}-${String(months.indexOf(match[3])+1).padStart(2,'0')}-${match[2]}`;
  return profileCalendar(date)&&weekdays[new Date(date+'T00:00:00Z').getUTCDay()]===match[1]?date:null;
}
export function preparePlane(raw:Record<string,Json>,row:number) {
  const result=profileRow(raw,row),{payload,error,omit}=result;
  for(const field of ['Target Date','Start Date'])if(profileNonempty(raw[field])) {
    const date=planeDate(raw[field]);
    if(!date)error(field,'plane_invalid_calendar','Expected a valid English weekday, day, abbreviated month and four-digit year, such as Fri, 30 Oct 2026.');
    else payload[field]=date;
  }
  if(profileNonempty(raw.Labels)&&typeof raw.Labels==='string')payload.Labels=raw.Labels.split(', ').map(value=>value.trim());
  if(profileNonempty(raw.Assignees)&&typeof raw.Assignees==='string'&&raw.Assignees.split(', ').length>1)
    omit('Assignees','plane_multiple_assignees','Vector supports one assignee. This comma-space list contains multiple people; no first person is selected.');
  if(profileNonempty(raw.Priority)&&typeof raw.Priority==='string')payload.Priority=raw.Priority.toLowerCase();
  if(profileNonempty(raw.Estimate)&&(typeof raw.Estimate!=='string'||!/^\d+$/.test(raw.Estimate)||Number(raw.Estimate)<1||Number(raw.Estimate)>100))
    omit('Estimate','plane_estimate_scale','This Plane estimate is not an integer point value from 1 to 100; no scale conversion is inferred.');
  return {payload,errors:result.errors};
}

export function planeOmission(field:string):{code:string;message:string}|undefined {
  if(['Created At','Updated At','Completed At','Archived At'].includes(field))return {code:'plane_ambiguous_timestamp',message:'Plane exports a 12-hour clock without AM/PM. The source instant cannot be recovered; no timestamp is inferred. Vector has no archive state.'};
  if(['Attachment Links','Attachment Count'].includes(field))return {code:'plane_attachment_bytes_absent',message:'Attachment metadata contains no file bytes. Files and links are not imported or fetched.'};
  if(field==='Comments')return {code:'plane_comments_unsupported',message:'Plane comments are retained without importing bodies, authors or dates.'};
  if(field==='Relations')return {code:'plane_relations_unsupported',message:'Plane relation kinds are retained without creating links or dependencies. Parent is handled separately.'};
  return undefined;
}
