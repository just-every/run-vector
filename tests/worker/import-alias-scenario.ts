import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {Buffer} from 'node:buffer';
import {createServerApp} from '../../src/core/app/server';
import {request,bindings,invite,actor} from './base-auth-fixture';
import type {setupImport} from './data-import-fixture';
/** One move-in journey: real CSV, native read doors and signed GitHub ingress. */
export async function importAliasScenario(f:Awaited<ReturnType<typeof setupImport>>) {
 const native=await f.create({title:'synthetic-vector-1800 native collision'});
 const csv=[['ID','Title','Description','Team','Status'],['ENG-123','synthetic-vector-1801 imported login','Imported text',f.team.name,f.status.name],['ENG-124','synthetic-vector-1802 branch work','',f.team.name,f.status.name],[native.identifier,'synthetic-vector-1803 colliding import','',f.team.name,f.status.name]].map((row,index)=>index===0?[...row,'Estimate','Priority','Project','Assignee','Labels','Cycle Name','Created','Updated','Due Date','Parent issue','Archived']:[...row,...Array(11).fill('')]).map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n');
 const input={format:'linear-csv' as const,source:'synthetic-vector-1804',name:'linear.csv',base64:Buffer.from(csv).toString('base64'),mapping:{}},run=await f.publish(input);
 const search=async(value:string,cookie=f.cookie)=>{const response=await request('/api/search?q='+encodeURIComponent(value),'GET',undefined,cookie);expect(response.status,await response.clone().text()).toBe(200);return (await response.json() as {issues:{id:string;identifier:string;title:string}[]}).issues;};
 const url='https://linear.app/synthetic-vector-1804/issue/ENG-123/login';
 const results=await search(url);expect(results).toHaveLength(1);const imported=results[0];expect(imported.title).toBe('synthetic-vector-1801 imported login');
 const redirect=async(key:string,cookie=f.cookie)=>request('/alias/'+key,'GET',undefined,cookie);
 expect((await redirect('eng-123')).headers.get('Location')).toBe('/app/issues/'+imported.identifier);
 expect((await redirect('ENG-123','')).status).toBe(401);
 expect((await redirect(native.identifier)).headers.get('Location')).toBe('/app/issues/'+native.identifier);
 expect((await search(native.identifier))[0].id).toBe(native.id);
 const report=await (await f.call('/data/import/runs/'+run.id+'/report')).json() as {aliasCollisions:object[]};
 expect(report.aliasCollisions).toEqual([{alias:native.identifier,importedIdentifier:expect.any(String),nativeIdentifier:native.identifier,reason:'native_identifier_wins'}]);
 const reportCsv=await (await f.call('/data/import/runs/'+run.id+'/report.csv')).text();expect(reportCsv).toContain(native.identifier+': native '+native.identifier+' wins');
 expect((await f.publish(input)).id).toBe(run.id);expect(await search(url)).toEqual(results);
 const app=createServerApp();expect((await app.request(bindings.APP_ORIGIN+'/alias/ENG-123',{headers:{Cookie:f.cookie,host:new URL(bindings.APP_ORIGIN).host,origin:bindings.APP_ORIGIN}},bindings)).headers.get('Location')).toBe('/app/issues/'+imported.identifier);
 const urls=f.input([f.row('GH-42',{title:'synthetic-vector-1810 source URL',sourceUrl:'https://github.com/octocat/test-repo1/issues/42'}),f.row('PROJ-45',{title:'synthetic-vector-1811 Jira source'})],'synthetic-vector-1812');
 urls.mapping.sourceUrl='sourceUrl';await f.publish(urls);
 const githubSource=(await search('https://github.com/octocat/test-repo1/issues/42'))[0];expect(githubSource.title).toBe('synthetic-vector-1810 source URL');
 expect((await search('https://synthetic-vector-1812.atlassian.net/browse/PROJ-45'))[0].title).toBe('synthetic-vector-1811 Jira source');
 expect((await f.call('/issues/ENG-123')).status).toBe(200);
 const referring=await f.create({title:'synthetic-vector-1813 references',description:'See ENG-123 and GH-42'});
 expect((await (await f.call('/issues/'+referring.identifier+'/references')).json()) as object).toMatchObject({references:expect.arrayContaining([expect.objectContaining({identifier:'ENG-123',canonicalIdentifier:imported.identifier}),expect.objectContaining({identifier:'GH-42',canonicalIdentifier:githubSource.identifier})])});
 expect(await env.DB.prepare('SELECT count(*) n FROM issue_reference_subjects WHERE source_issue_id=? AND target_issue_id=?').bind(referring.id,imported.id).first<number>('n')).toBe(1);
 const configured=await f.call('/settings/integrations/github','POST',{name:'synthetic-vector-1805',repository:'octocat/test-repo1'});expect(configured.status).toBe(201);
 const config=await configured.json() as {id:string;secret:string;receiver:string};
 const done=f.team.statuses.find(s=>s.category==='completed')!;
 expect((await f.call('/settings/teams/'+f.team.id,'PATCH',{githubAutomation:{trigger:'merged',statusId:done.id,allowReopen:false,expectedVersion:0}})).status).toBe(200);
 const send=async(body:unknown,delivery=crypto.randomUUID(),tamper=false,event='pull_request')=>{
  const text=JSON.stringify(body),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))),signature=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return app.request(config.receiver,{method:'POST',headers:{'X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Delivery':delivery,'X-GitHub-Event':event,'Content-Type':'application/json'},body:tamper?text+' ':text},bindings);
 };
 const pr=(number:number,key='ENG-123',body='Fixes '+key,title='Fixes '+key)=>({action:'closed',number,repository:{full_name:'octocat/test-repo1'},pull_request:{number,title,body,head:{ref:key.toLowerCase()+'-fix-login'},state:'closed',merged:true,updated_at:'2026-10-01T00:00:00.000Z',html_url:'https://github.com/octocat/test-repo1/pull/'+number}});
 const read=async()=>await (await f.call('/issues/'+imported.identifier)).json() as {version:number;status:{id:string};activity:{kind:string}[]};
 const before=await read();expect((await send(pr(181),crypto.randomUUID(),true)).status).toBe(401);expect(await read()).toEqual(before);
 expect((await f.call('/data/aliases/prefixes/ENG','PATCH',{active:false})).status).toBe(200);
 expect((await redirect('ENG-123')).status).toBe(404);expect(await search(url)).toEqual([]);
 const disabledDelivery=crypto.randomUUID();expect((await send(pr(181),disabledDelivery)).status).toBe(200);expect(await read()).toEqual(before);
 expect((await f.call('/data/aliases/prefixes/ENG','PATCH',{active:true})).status).toBe(200);
 expect((await send(pr(181),disabledDelivery)).status).toBe(200);expect(await read()).toEqual(before);
 const delivery=crypto.randomUUID();expect((await send(pr(182),delivery)).status).toBe(200);
 const completed=await read();expect(completed.status.id).toBe(done.id);expect(completed.version).toBe(before.version+1);
 expect((await (await f.call('/issues/'+imported.identifier+'/github')).json()) as object).toMatchObject({pullRequests:[{number:182,state:'merged'}]});
 for(const replay of [delivery,crypto.randomUUID()])expect((await send(pr(182),replay)).status).toBe(200);
 expect(await read()).toEqual(completed);
 expect(await env.DB.prepare("SELECT count(*) n FROM issue_activity WHERE issue_id=? AND kind='github.pr_linked'").bind(imported.id).first<number>('n')).toBe(1);
 // Branch-only and title-only references use the same alias resolution.
 expect((await send(pr(183,'ENG-124','','synthetic-vector-1806'))).status).toBe(200);
 expect((await send(pr(184,'ENG-124','','Fixes ENG-124'))).status).toBe(200);
 const branch=(await search('ENG-124'))[0];
 expect((await (await f.call('/issues/'+branch.identifier+'/github')).json()) as object).toMatchObject({pullRequests:[expect.objectContaining({number:183}),expect.objectContaining({number:184})]});
 // A commit carrying the old key completes the same retained issue once.
 const push={ref:'refs/heads/main',repository:{full_name:'octocat/test-repo1',default_branch:'main'},commits:[{id:'a'.repeat(40),message:'Fixes ENG-124',author:{name:'synthetic-vector-1807'},url:'https://github.com/octocat/test-repo1/commit/'+'a'.repeat(40)}]};
 expect((await send(push,crypto.randomUUID(),false,'push')).status).toBe(200);
 expect((await send(pr(185,native.identifier))).status).toBe(200);
 expect((await (await f.call('/issues/'+native.identifier+'/github')).json()) as object).toMatchObject({pullRequests:[{number:185}]});
 const memberCookie=await invite('synthetic-vector-1808'+'@'+'example.test',f.cookie),member=await actor(memberCookie);
 const prefixBefore=(await env.DB.prepare('SELECT * FROM issue_alias_prefixes ORDER BY prefix').all()).results;
 expect((await request('/api/data/aliases/prefixes/ENG','PATCH',{active:false},memberCookie)).status).toBe(403);
 expect((await env.DB.prepare('SELECT * FROM issue_alias_prefixes ORDER BY prefix').all()).results).toEqual(prefixBefore);
 // Current privacy, membership withdrawal and revoked sessions fence bookmarks and search.
 expect((await f.call('/settings/teams/'+f.team.id+'/privacy','PUT',{isPrivate:true})).status).toBe(200);
 expect((await redirect('ENG-123',memberCookie)).status).toBe(404);expect(await search(url,memberCookie)).toEqual([]);
 expect((await f.call('/settings/teams/'+f.team.id+'/members/'+member,'PUT',{role:'member'})).status).toBe(200);
 expect((await redirect('ENG-123',memberCookie)).status).toBe(302);
 expect((await f.call('/settings/teams/'+f.team.id+'/members/'+member,'DELETE')).status).toBe(200);
 expect((await redirect('ENG-123',memberCookie)).status).toBe(404);
 expect((await request('/auth/signout','POST',{},memberCookie)).status).toBe(303);
 expect((await redirect('ENG-123',memberCookie)).status).toBe(401);
 // Erasure destroys aliases with custody; replay cannot resurrect the imported issue.
 const current=await read();expect((await f.call('/issues/'+imported.identifier,'DELETE',{expectedVersion:current.version,confirmed:true})).status).toBe(200);
 expect((await redirect('ENG-123')).status).toBe(404);expect(await search(url)).toEqual([]);
 expect((await send(pr(186))).status).toBe(200);expect((await redirect('ENG-123')).status).toBe(404);
 await f.publish(input);expect((await redirect('ENG-123')).status).toBe(404);expect(await env.DB.prepare('SELECT count(*) n FROM issue_aliases WHERE issue_id=?').bind(imported.id).first<number>('n')).toBe(0);
 expect((await f.call('/settings/integrations/github/'+config.id,'DELETE')).status).toBe(200);
 expect((await send(pr(187))).status).toBe(401);
}
