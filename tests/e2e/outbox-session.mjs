import { devKey } from './dev-gate.mjs';
import assert from 'node:assert/strict';
import { readLocalD1 } from './local-d1-read.mjs';
/** Test-only delivery observation at the local mail edge; no captured-mail UI is served. */
export async function readDevelopmentLink(origin, _request, email, state) {
 const row=readLocalD1(state, `SELECT message FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email.trim().toLowerCase().replaceAll("'","''")}' ORDER BY created_at DESC,sequence DESC LIMIT 1`)[0];
 assert.ok(row,'Mail edge received a message for the requested operator');
 const target=new URL(JSON.parse(row.message).text.match(/https?:\/\/[^\s]+/)[0]);
 assert.equal(target.origin,origin);assert.equal(target.pathname,'/auth/confirm');
 return target.href;
}
/** Ordinary Base landing is inert; only same-origin POST confirms the token. */
export async function confirmLink(link) {
 const url=new URL(link);
 const response=await fetch(url,{redirect:'manual'});
 const preview=new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers:response.headers});
 assert.ok([200,400].includes(preview.status),'confirmation GET previews an unused link or rejects an invalid link');
 assert.equal(preview.headers.get('set-cookie'),null,'preview cannot create a session');
 if(preview.status===400)return preview;
 return fetch(new URL('/auth/confirm',url),{method:'POST',redirect:'manual',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({token:url.searchParams.get('token')})});
}
export const localAuthSecret = 'fixture-native-runtime-secret-with-at-least-32-characters';
// These journeys exercise the sample workspace explicitly; production builds
// keep sample data disabled.
export const localAuthArguments = ['--var','SEED_SAMPLE_DATA:true','--var','SESSION_SECRET:'+localAuthSecret,'--var','RER_DEV_KEY:'+devKey,'--var','FIRST_OWNER_EMAIL:sarah@vector.test','--var','MAIL_FROM:Vector <signin@vector.test>','--var','MAIL_MODE:local-outbox','--var','WORKSPACE_NAME:Vector'];
