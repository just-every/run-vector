import type { ImportDiagnostic,JiraDateReview } from './types';

export type JiraDateCell = { row:number; column:number; field:string; value:string };
type Parts = { year:number; first:number; second:number; family:'ISO'|'numeric'|'month'; hour:number; minute:number; secondOfMinute:number; offset:string; timed:boolean; shortYear:boolean };
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function parts(value:string,century?:number):Parts|null {
  const match=/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})|\d{1,2}\/[A-Za-z]{3}\/(?:\d{4}|\d{2}))(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?(AM|PM))?(Z|[+-]\d{2}:\d{2})?)?$/i.exec(value);
  if(!match)return null;
  const date=match[1],family=date.includes('-')?'ISO':/[A-Za-z]/.test(date)?'month':'numeric',values=date.split(family==='ISO'?'-':'/');
  const year=values[family==='ISO'?0:2],shortYear=year.length===2;
  const hour=Number(match[2]??0),meridiem=match[5]?.toUpperCase();
  if(meridiem&&(hour<1||hour>12))return null;
  const result:Parts={family,shortYear,year:Number(year)+(shortYear?(century??0):0),first:Number(values[family==='ISO'?1:0]),second:family==='month'?months.indexOf(values[1].toLowerCase())+1:Number(values[family==='ISO'?2:1]),hour:meridiem?(hour%12+(meridiem==='PM'?12:0)):hour,minute:Number(match[3]??0),secondOfMinute:Number(match[4]??0),offset:match[6]?.toUpperCase()??'',timed:Boolean(match[2])};
  if((!shortYear&&result.year<1000) || result.hour>23 || result.minute>59 || result.secondOfMinute>59 || (result.offset && !validOffset(result.offset)))return null;
  return result;
}
export function validOffset(value:string) { return /^(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(value); }
function calendar(p:Parts,order:'DMY'|'MDY') {
  const month=p.family==='ISO'||(p.family==='numeric'&&order==='MDY')?p.first:p.second;
  const day=p.family==='ISO'||(p.family==='numeric'&&order==='MDY')?p.second:p.first;
  const date=new Date(Date.UTC(p.year,month-1,day));
  return month>=1&&month<=12&&day>=1&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${p.year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;
}
/** Infer from every cell, never from a sample or the host locale. Different time
 * precisions are allowed; calendar families and numeric order must agree. */
export function readJiraDates(cells:JiraDateCell[],sourceOffset?:string,shortYearCentury?:number) {
  const errors:ImportDiagnostic[]=[],values=new Map<string,string>();
  const fail=(cell:JiraDateCell,code:string,message:string)=>errors.push({row:cell.row,field:cell.field,code,message});
  const parsed=cells.map(cell=>({cell,parts:parts(cell.value,shortYearCentury)}));
  for(const {cell,parts:p} of parsed)if(!p)fail(cell,'jira_invalid_date','Unsupported or impossible date. Use a documented numeric, English month-name or ISO calendar with a valid 24-hour or AM/PM time. See docs/JIRA-CSV.md.');
  for(const {cell,parts:p} of parsed)if(p?.shortYear&&shortYearCentury===undefined)fail(cell,'jira_short_year_century_required','Two-digit years require an explicit short-year century, for example 2000 for 2000–2099. No century is guessed.');
  const valid=parsed.filter((entry):entry is {cell:JiraDateCell;parts:Parts}=>entry.parts!==null&&(!entry.parts.shortYear||shortYearCentury!==undefined));
  const families=new Set(valid.map(entry=>entry.parts.family+(entry.parts.shortYear?':YY':':YYYY')));
  if(families.size>1)errors.push({row:0,code:'jira_mixed_dates',message:'Calendar formats are mixed; use one calendar pattern throughout all dates, including comments and attachments.'});
  const numeric=valid.filter(entry=>entry.parts.family==='numeric');
  const dmy=numeric.every(entry=>calendar(entry.parts,'DMY')),mdy=numeric.every(entry=>calendar(entry.parts,'MDY'));
  let order:'DMY'|'MDY'='DMY';
  if(numeric.length) {
    if(dmy&&mdy)errors.push({row:0,code:'jira_ambiguous_dates',message:'Day/month order is ambiguous across the whole file. Export or rewrite dates with an unambiguous calendar pattern.'});
    else if(!dmy&&!mdy)errors.push({row:0,code:'jira_mixed_dates',message:'Numeric dates have conflicting day/month orders or impossible calendar dates.'});
    else order=dmy?'DMY':'MDY';
  }
  for(const {cell,parts:p} of valid) {
    const date=calendar(p,order);
    if(!date){fail(cell,'jira_invalid_date','The date is not a possible calendar day.');continue;}
    // Due dates alone are calendar days. Every other field represents an instant.
    if(cell.field.toLowerCase()==='due date'&&!p.timed){values.set(cell.row+':'+cell.column,date);continue;}
    const offset=p.offset||sourceOffset;
    if(!offset){fail(cell,'jira_source_offset_required','This timestamp has no offset. Supply the exporting user’s source offset explicitly; Vector never guesses UTC or the machine timezone.');continue;}
    if(!validOffset(offset)){fail(cell,'jira_invalid_offset','Supply Z or an explicit offset between -14:00 and +14:00.');continue;}
    const time=[p.hour,p.minute,p.secondOfMinute].map(value=>String(value).padStart(2,'0')).join(':');
    const instant=new Date(date+'T'+time+offset).toISOString();
    values.set(cell.row+':'+cell.column,cell.field.toLowerCase()==='due date'?date:instant);
  }
  const family=valid[0]?.parts.family,pattern=family==='ISO'?'YYYY-MM-DD':family==='month'?'D/Mon/YYYY':numeric.length?(dmy!==mdy?(order==='DMY'?'D/M/YYYY':'M/D/YYYY'):'undetermined numeric order'):'no dates';
  const review:JiraDateReview={pattern:valid[0]?.parts.shortYear?pattern.replace('YYYY','YY'):pattern,shortYearCentury:shortYearCentury??null,sample:cells[0]?.value??'',sourceOffset:sourceOffset??'none supplied',policy:'Explicit cell offsets take precedence. Offsetless instants require the supplied fixed offset; due dates remain calendar days. No timezone or DST inference.',cells:cells.length};
  return {errors,values,review};
}
