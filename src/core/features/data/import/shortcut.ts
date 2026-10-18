import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { ImportMapping } from './types';
import { profileCalendar,profileInstant,profileNonempty,profileRow } from './profile-values';

export const shortcutMapping:ImportMapping={sourceId:'id',title:'name',description:'description',team:'team',status:'state',project:'project',cycle:'iteration',estimate:'estimate',dueDate:'due_date',createdAt:'created_at',updatedAt:'updated_at',priority:'priority'};
export function prepareShortcut(raw:Record<string,Json>,row:number) {
  const result=profileRow(raw,row),{payload,omit}=result;
  for(const field of ['created_at','updated_at'])if(profileNonempty(raw[field])) {
    const value=profileInstant(raw[field]);
    if(value)payload[field]=value;
    else omit(field,'shortcut_timestamp_unsupported','Only possible ISO timestamps with an explicit timezone are supported. Export timestamp grammar is unverified; no local timezone is guessed.');
  }
  if(profileNonempty(raw.due_date)&&(typeof raw.due_date!=='string'||!profileCalendar(raw.due_date)))
    omit('due_date','shortcut_due_date_unsupported','Only an explicit YYYY-MM-DD calendar day is supported. No calendar day is inferred from a timestamp or localized date.');
  if(profileNonempty(raw.priority)) {
    const value=typeof raw.priority==='string'?raw.priority.toLowerCase():'';
    if(['none','urgent','high','medium','low'].includes(value))payload.priority=value;
    else omit('priority','shortcut_custom_priority_unsupported','Only the scalar priority names none, urgent, high, medium and low are supported. Other custom field values need a separate policy.');
  }
  return {payload,errors:result.errors};
}

export function shortcutOmission(field:string):{code:string;message:string}|undefined {
  if(['owners','labels','epic_labels','epic_label'].includes(field))return {code:'shortcut_list_encoding_unverified',message:'The export list delimiter is unverified. The full cell is retained; importer semicolon syntax is not assumed for exports.'};
  if(['is_blocked','is_a_blocker'].includes(field))return {code:'shortcut_relation_endpoints_absent',message:'This boolean supplies no related story IDs and cannot create a dependency or relation.'};
  if(field==='is_archived')return {code:'shortcut_archive_unsupported',message:'Vector has no issue archive state. The source flag is retained without archiving the issue.'};
  if(['tasks','external_tickets','external_ticket_count'].includes(field))return {code:'shortcut_nested_data_unsupported',message:'Task or external-ticket metadata is retained without creating issues, comments, links or files.'};
  return undefined;
}
