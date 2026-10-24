import type { WorkerBindings } from '../../app/bindings';
import { z } from 'zod';
import { verifyEventSignature } from './event-signature';
const events=z.array(z.object({sg_event_id:z.string().min(1).max(200),sg_message_id:z.string().min(1).max(300),email:z.email(),event:z.enum(['processed','delivered','bounce'])})).min(1).max(100);
const response=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function receiveProviderEvents(env:WorkerBindings,request:Request,teamId:string) {
  const config=await env.DB.prepare('SELECT event_verification_key FROM team_email_intake WHERE team_id=? AND enabled=1').bind(teamId).first<{event_verification_key:string|null}>();
  const timestamp=request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp')??'',signed=request.headers.get('X-Twilio-Email-Event-Webhook-Signature')??'';
  if(!config?.event_verification_key||!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!signed)return response('invalid_signature',401);
  const reader=request.body?.getReader();if(!reader)return response('invalid_request',400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536){await reader.cancel();return response('invalid_request',413);}chunks.push(part.value);}
  const bodyBytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bodyBytes.set(chunk,offset);offset+=chunk.length;}
  let body:string;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bodyBytes);}catch{return response('invalid_request',400);}
  if(!await verifyEventSignature(config.event_verification_key,signed,timestamp,body))return response('invalid_signature',401);
  let input;try{input=events.safeParse(JSON.parse(body));}catch{return response('invalid_request',400);}
  if(!input.success)return response('invalid_request',400);
  const writes:D1PreparedStatement[]=[],seen=new Set<string>(),at=new Date().toISOString();
  for(const event of input.data){
    if(seen.has(event.sg_event_id)||await env.DB.prepare('SELECT 1 FROM intake_email_provider_events WHERE team_id=? AND event_id=?').bind(teamId,event.sg_event_id).first())return response('replayed_event',409);
    seen.add(event.sg_event_id);
    const delivery=await env.DB.prepare(`SELECT d.id FROM intake_email_deliveries d JOIN intake_email_messages m ON m.id=d.root_id JOIN issues i ON i.id=d.issue_id
      WHERE m.team_id=? AND d.kind='reply' AND d.comment_id IS NOT NULL AND d.status='accepted' AND m.status='received' AND (lower(m.sender)=? OR EXISTS(SELECT 1 FROM json_each(m.cc_json) cc WHERE lower(cc.value)=?))
      AND length(d.provider_message_id)>0 AND (d.provider_message_id=? OR substr(?,1,length(d.provider_message_id)+1)=d.provider_message_id||'.')`).bind(teamId,event.email.toLowerCase(),event.email.toLowerCase(),event.sg_message_id,event.sg_message_id).first<{id:string}>();
    if(!delivery)return response('foreign_event',404);
    const outcome=event.event==='bounce'?'bounced':'accepted';
    writes.push(env.DB.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM intake_email_deliveries d JOIN intake_email_messages m ON m.id=d.root_id JOIN issues i ON i.id=d.issue_id
      WHERE d.id=? AND d.status='accepted' AND d.comment_id IS NOT NULL AND m.status='received' AND m.team_id=?) THEN 1 ELSE json('event delivery unavailable') END`).bind(delivery.id,teamId),
      env.DB.prepare('INSERT INTO intake_email_provider_events(team_id,event_id,delivery_id,outcome,created_at) VALUES(?,?,?,?,?)').bind(teamId,event.sg_event_id,delivery.id,outcome,at),
      env.DB.prepare(`UPDATE intake_email_deliveries SET provider_outcome=CASE WHEN provider_outcome='bounced' THEN 'bounced' ELSE ? END,updated_at=? WHERE id=? AND status='accepted' AND issue_id IS NOT NULL`).bind(outcome,at,delivery.id));
  }
  // A key change, restore or issue erasure racing the verified event aborts the complete batch.
  const guard=env.DB.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM team_email_intake WHERE team_id=? AND enabled=1 AND event_verification_key=?) AND NOT EXISTS(SELECT 1 FROM vector_http_restore) AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1) THEN 1 ELSE json('event authority changed') END`).bind(teamId,config.event_verification_key);
  try{await env.DB.batch([guard,...writes]);}
  catch(error){if(String(error).includes('UNIQUE constraint failed: intake_email_provider_events'))return response('replayed_event',409);throw error;}
  return Response.json({accepted:input.data.length},{headers:{'Cache-Control':'no-store'}});
}
