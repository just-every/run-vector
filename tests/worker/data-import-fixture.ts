import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { setupAdministration } from './administration-fixture';
import type { ImportInput,ImportPreview } from '../../src/core/features/data/import/types';
import type { ImportJob } from '../../vendor/base/import-kit/src/d1/index';
export async function setupImport(){
 const f=await setupAdministration(),team=f.initial.teams[0],status=team.statuses.find(row=>row.category==='unstarted')!;
 const mapping={sourceId:'id',title:'title',description:'description',team:'team',status:'status',priority:'priority',createdAt:'created',updatedAt:'updated',parent:'parent',dependencies:'dependencies'};
 const row=(id:string,extra:Record<string,unknown>={})=>({id,title:'Imported '+id,description:'Résumé with evidence',team:team.name,status:status.name,priority:'high',created:'2026-09-01T01:02:03.000Z',updated:'2026-09-02T04:05:06.000Z',parent:'',dependencies:'',...extra});
 const input=(rows:unknown[],source='reviewed-fixture'):ImportInput=>({format:'json',source,name:'issues.json',base64:Buffer.from(JSON.stringify(rows)).toString('base64'),mapping:{...mapping}});
 const preview=async(value:ImportInput)=>{const response=await f.call('/data/import/preview','POST',value);expect(response.status).toBe(200);return await response.json() as ImportPreview;};
 const apply=async(value:ImportInput,review:ImportPreview,key='review:'+review.fingerprint)=>f.call('/data/import/apply','POST',{input:{...value,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:key,acknowledgeOmissions:true});
 // Apply creates the reviewed run; each resume publishes its next batch.
 const finish=async(run:ImportJob)=>{for(let request=0;!['completed','rolled_back','undone'].includes(run.state);request++){expect(request).toBeLessThan(500);const response=await f.call('/data/import/runs/'+run.id+'/resume','POST',{});expect(response.status,await response.clone().text()).toBe(200);run=await response.json() as ImportJob;}return run;};
 const publish=async(value:ImportInput)=>{const review=await preview(value);expect(review.errors).toEqual([]);expect(review.ready).toBe(true);const response=await apply(value,review);expect(response.status,await response.clone().text()).toBe(200);return finish(await response.json() as ImportJob);};
 const effects=async()=>Promise.all([...['notifications','notification_deliveries','notification_candidates','vector_webhook_events','integration_deliveries'].map(table=>env.DB.prepare('SELECT count(*) AS n FROM '+table).first<number>('n')),env.DB.prepare("SELECT count(*) AS n FROM oa_operators WHERE status='invited'").first<number>('n')]);
 return {...f,team,status,row,input,preview,apply,finish,publish,effects};
}
