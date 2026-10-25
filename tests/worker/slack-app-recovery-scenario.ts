import {makePart,canonicalJson,sha256,readArchive} from '@runeditrun/rer/modules/portability';
import type {ArchiveRecords,Part} from './http-archive-fixture';
import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {bindings,origin} from './base-auth-fixture';
import type {setupIntegrations} from './integration-fixture';
import {httpExport,freshTarget,stageArchive,finalBody,targetCall,targetSignIn,destination,targetBindings} from './http-archive-fixture';
export async function slackAppArchive(f:Awaited<ReturnType<typeof setupIntegrations>>,secrets:string[]){
 const encrypted=(await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'slack%'").all<{encrypted:string}>()).results.map(row=>row.encrypted);
 expect(encrypted.length).toBeGreaterThan(0);
 const receipts=(await env.DB.prepare('SELECT * FROM vector_slack_event_receipts ORDER BY event_key').all()).results;
 const exported=await httpExport(f.call),bytes=JSON.stringify(exported);
 const records=await compactSlackArchive(exported);
 for(const value of [...secrets,...encrypted])expect(bytes).not.toContain(value);
 const cookie=await freshTarget(),job=await stageArchive(records,cookie);
 const finalized=await targetCall('/api/portability/imports/'+job+'/finalize','POST',finalBody(records),cookie);expect(finalized.status,await finalized.clone().text()).toBe(200);
 const restored=await targetSignIn(),call=(path:string,method='GET',body?:unknown)=>targetCall('/api'+path,method,body,restored);
 const app=await call('/settings/integrations/slack/app');expect(app.status).toBe(200);expect((await app.json() as any).app).toBeNull();
 const channels=await call('/settings/integrations/channels');expect(channels.status).toBe(200);expect((await channels.json() as any).slack).toMatchObject({connected:false,needsAttention:true,signingSecret:false});
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM vector_slack_member_links').all()).results).toEqual([]);
 expect((await destination.ARCHIVE_TARGET_DB.prepare("SELECT * FROM vector_integration_secret_keys WHERE identity LIKE 'slack%'").all()).results).toEqual([]);
 expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM vector_slack_event_receipts ORDER BY event_key').all()).results).toEqual(receipts);
 expect((await call('/settings/integrations/slack/app/install','POST',{})).status).toBe(409);
 // The restored public Events door cannot authenticate with an exported secret.
 const response=await f.app.request(origin+'/api/integrations/slack/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'url_verification',challenge:'synthetic-vector-33020'})},targetBindings);expect(response.status).toBe(401);
}
export async function slackProviderUninstall(f:Awaited<ReturnType<typeof setupIntegrations>>,secret:string,type:'app_uninstalled'|'tokens_revoked'){
 const timestamp=String(Math.floor(Date.now()/1000)),body=JSON.stringify({type:'event_callback',event_id:'synthetic-vector-'+crypto.randomUUID(),event:{type}}),encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('v0:'+timestamp+':'+body))),signature='v0='+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 const send=()=>f.app.request(origin+'/api/integrations/slack/events',{method:'POST',headers:{'content-type':'application/json','x-slack-request-timestamp':timestamp,'x-slack-signature':signature},body},bindings);
 const issues=(await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results;
 const accepted=await send();expect(accepted.status,await accepted.clone().text()).toBe(200);
 expect((await (await f.call('/settings/integrations/channels')).json() as any).slack.connected).toBe(false);
 expect((await (await f.call('/settings/integrations/slack/app')).json() as any).app).toBeNull();
 expect(await env.DB.prepare("SELECT count(*) n FROM vector_integration_secret_keys WHERE identity LIKE 'slack%'").first<number>('n')).toBe(0);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_slack_member_links').first<number>('n')).toBe(0);
 expect(await env.DB.prepare("SELECT count(*) n FROM vector_webhook_destinations WHERE kind='slack' AND enabled=1").first<number>('n')).toBe(0);
 expect((await send()).status).toBe(401);
 expect((await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results).toEqual(issues);
}

/** Keep every exported item and its original content digest. Native export emits
 * a part per populated table; packing the same ordered items avoids repeating
 * the full HTTP import admission for dozens of tiny parts in this Slack proof.
 * The native reader verifies the original content digest before any upload. */
async function compactSlackArchive(exported:ArchiveRecords):Promise<ArchiveRecords>{
 const items=exported.filter((row):row is Part=>row.kind==='part').flatMap(part=>part.items),parts:Part[]=[];
 for(let offset=0;offset<items.length;offset+=500)parts.push(await makePart(parts.length,items.slice(offset,offset+500)));
 const manifest={...exported[0],partCount:parts.length};
 const closing={...exported.at(-1),partCount:parts.length,archiveHash:await sha256(canonicalJson({manifest,parts:parts.map(part=>part.sha256)}))};
 const source=new Response([manifest,...parts,closing].map(row=>JSON.stringify(row)).join('\n')+'\n').body!;
 const checked:ArchiveRecords=[];for await(const record of readArchive(source))checked.push(record);
 return checked;
}
