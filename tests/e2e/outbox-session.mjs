import assert from 'node:assert/strict';
import { devKey, keyHeader } from './dev-gate.mjs';
const decodeHref=value=>value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
const escapeText=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
/** Read the same local outbox index/detail that the owner opens. */
export async function readDevelopmentLink(origin,request,email,key=devKey) {
 const index=await request('/__dev/outbox','GET',undefined,'',keyHeader(key));assert.equal(index.status,200);
 const article=(await index.text()).match(/<article>[\s\S]*?<\/article>/g)?.find(row=>row.includes(escapeText(email.trim().toLowerCase())));
 assert.ok(article,'Native outbox captured a message for the requested operator');
 const href=article.match(/href="([^"]+\?message=[^"]+)"/)?.[1];assert.ok(href,'Captured message has a detail link');
 const message=new URL(decodeHref(href),origin);assert.equal(message.origin,origin);
 const detail=await request(message.pathname+message.search,'GET',undefined,'',keyHeader(key));assert.equal(detail.status,200);
 const link=(await detail.text()).match(/class="open" href="([^"]+)"/)?.[1];assert.ok(link,'Captured native message exposes its sign-in link');
 const target=new URL(decodeHref(link));assert.equal(target.origin,origin);assert.equal(target.pathname,'/auth/confirm');
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
export const localAuthArguments = ['--var','SESSION_SECRET:'+localAuthSecret,'--var','RER_DEV_KEY:'+devKey,'--var','FIRST_OWNER_EMAIL:sarah@vector.test','--var','MAIL_FROM:Vector <signin@vector.test>','--var','MAIL_MODE:local-outbox'];
