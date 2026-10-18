import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { ImportMapping } from './types';
import { profileInstant,profileNonempty,profileRow } from './profile-values';

export const hulyMapping:ImportMapping={sourceId:'_id',title:'title',description:'description',status:'status',priority:'priority',project:'space',assignee:'assignee',createdAt:'createdOn',updatedAt:'modifiedOn'};
const priorities=['none','urgent','high','medium','low'];
export function prepareHuly(raw:Record<string,Json>,row:number) {
  const result=profileRow(raw,row),{payload,error,omit}=result;
  if(raw._class!=='tracker:class:Issue')error('_class','huly_issue_class_required','Each row must be a flattened tracker:class:Issue document. Other document classes are refused, never silently skipped.');
  if(profileNonempty(raw.description)&&typeof raw.description!=='string')
    omit('description','huly_markup_unsupported','This description is structured markup, not text. It is retained without stringification.');
  if(profileNonempty(raw.priority)) {
    if(typeof raw.priority==='number'&&Number.isInteger(raw.priority)&&raw.priority>=0&&raw.priority<=4)payload.priority=priorities[raw.priority];
    else error('priority','huly_invalid_priority','Expected Huly numeric priority 0 (none), 1 (urgent), 2 (high), 3 (medium) or 4 (low).');
  }
  for(const field of ['createdOn','modifiedOn'])if(profileNonempty(raw[field])) {
    const value=profileInstant(raw[field]);
    if(value)payload[field]=value;
    else error(field,'huly_invalid_timestamp','Expected a possible ISO timestamp with an explicit timezone. No local timezone is inferred.');
  }
  return {payload,errors:result.errors};
}

export function hulyOmission(field:string):{code:string;message:string}|undefined {
  if(field==='_class')return {code:'huly_source_class',message:'The source document class validates issue rows; it has no native issue field.'};
  if(field==='identifier')return {code:'huly_display_identifier',message:'The Huly display identifier remains source metadata. Stable _id identifies the imported row; Vector assigns its own identifier.'};
  if(field==='dueDate')return {code:'huly_due_date_policy_required',message:'Huly exports this date as an instant. No timezone-to-calendar policy was selected, so no due day is inferred.'};
  if(field==='estimation')return {code:'huly_hours_not_points',message:'Huly estimation is hours. Vector estimate is points; no hours-to-points conversion was selected.'};
  if(field==='attachments')return {code:'huly_attachment_bytes_absent',message:'Relative attachment paths contain no bytes in this JSON file. Files and links are not imported or fetched.'};
  if(field==='labels'||field==='comments')return {code:'huly_collection_unsupported',message:'Nested Huly collection documents are retained without importing their members.'};
  return undefined;
}
