import {z} from "zod";
export const triageResponsibilitySchema=z.object({
  mode:z.enum(["fixed","weekly"]),
  operatorIds:z.array(z.string().length(26)).min(1).max(52).refine(ids=>new Set(ids).size===ids.length),
  startsOn:z.string().date(),
}).strict().refine(value=>value.mode==='fixed' ? value.operatorIds.length===1 : value.operatorIds.length>=2,{message:"Choose one fixed person or at least two people for a weekly rotation."});
export type TriageResponsibility=z.infer<typeof triageResponsibilitySchema>;
export function responsibleOperator(config:TriageResponsibility,timezone:string,at:Date) {
  if(config.mode==='fixed')return config.operatorIds[0]!;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  const today=`${part('year')}-${part('month')}-${part('day')}`;
  const weeks=Math.max(0,Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(config.startsOn+'T00:00:00Z'))/604800000));
  return config.operatorIds[weeks%config.operatorIds.length]!;
}
export async function triageRecipient(db:D1Database,teamId:string,at:Date) {
  const row=await db.prepare("SELECT t.triage_responsibility_json,t.triage_enabled,w.timezone FROM teams t JOIN workspace_settings w ON w.id=t.workspace_id WHERE t.id=?").bind(teamId).first<{triage_responsibility_json:string|null;triage_enabled:number;timezone:string}>();
  if(!row?.triage_enabled || !row.triage_responsibility_json)return null;
  const config=triageResponsibilitySchema.parse(JSON.parse(row.triage_responsibility_json));
  return {id:responsibleOperator(config,row.timezone,at),json:row.triage_responsibility_json,timezone:row.timezone};
}
