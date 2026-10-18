import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { ImportDiagnostic } from './types';

export const profilePayloadKey='$profileOmissions';
export const profileNonempty=(value:Json|undefined):boolean=>value!==undefined&&value!==null&&(typeof value==='string'?Boolean(value.trim()):Array.isArray(value)?value.length>0:typeof value==='object'?Object.keys(value).length>0:true);
export const profileText=(value:Json|undefined)=>typeof value==='string'?value:JSON.stringify(value)??'';

/** Only derived cells change. Exact file bytes stay in the import artifact;
 * omitted cell values also travel with their per-row review diagnostic. */
export function profileRow(raw:Record<string,Json>,row:number) {
  const payload={...raw},errors:ImportDiagnostic[]=[],omissions:ImportDiagnostic[]=[];
  const error=(field:string,code:string,message:string)=>errors.push({row,field,code,message,value:profileText(raw[field])});
  if(Object.hasOwn(raw,profilePayloadKey))error(profilePayloadKey,'profile_reserved_column','This source field is reserved for import review metadata. Rename it before importing.');
  payload[profilePayloadKey]=omissions as unknown as Json;
  const omit=(field:string,code:string,message:string)=>{
    if(profileNonempty(raw[field]))omissions.push({row,field,code,message,value:profileText(raw[field])});
    payload[field]='';
  };
  return {payload,errors,error,omit};
}

export function profileCalendar(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1000)return false;
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
/** Explicit timezone only; Date.parse alone normalizes impossible calendar days. */
export function profileInstant(value:Json|undefined):string|null {
  if(typeof value!=='string')return null;
  const match=/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.exec(value);
  if(!match||!profileCalendar(match[1]))return null;
  const time=Date.parse(value);
  return Number.isFinite(time)?new Date(time).toISOString():null;
}
