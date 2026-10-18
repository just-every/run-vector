import { env } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { expect,it } from 'vitest';
import { contractTitle } from '../contract-tags';
import { generateJiraFixture } from '../fixtures/import/jira/generate.mjs';
import { setupJiraApply,checkJiraReconciliation } from './jira-apply-fixture';
import { createServerApp } from '../../src/core/app/server';
import { bindings,origin,invite,actor } from './base-auth-fixture';
import type { RollbackPreview } from '../../src/core/features/data/import/rollback';
it(contractTitle('DATA-010 REL-007','Jira 300-issue staged apply preserves relationships, comments and old keys, reconciles SQL, refuses edited rollback and wholly undoes an untouched run'),async(context)=>{
 const proof:Record<string,unknown>={};
 const f=await setupJiraApply(),nativeSentinel=await f.create({title:'Native same-key reference sentinel'});
 const input=f.inputJira('jira-full',f.fixture.csv.replace('OUTSIDE-9001',nativeSentinel.identifier));
 const before=await f.counts(),events=await f.effects();
 const review=await f.preview(input);expect(review.errors).toEqual([]);expect(review.ready).toBe(true);expect(await f.counts()).toEqual(before);
 expect(review.jiraReview!.unresolved.filter(item=>item.code==='jira_reference_outside_file')).toEqual([expect.objectContaining({sourceId:'710011',value:nativeSentinel.identifier})]);
 const apply=await f.apply(input,review,'jira-full-operation');expect(apply.status,await apply.clone().text()).toBe(200);const first=await apply.json();
 expect(await (await f.apply(input,review,'jira-full-operation')).json()).toEqual(first);
 const run=await f.finish(first),{report,rows}=await checkJiraReconciliation(f,run.id);
 expect(report.jiraReview).toEqual(review.jiraReview);
 expect(await (await f.apply(input,review,'jira-full-operation')).json()).toEqual(await (await f.call('/data/import/runs/'+run.id)).json());
 expect(await f.effects()).toEqual(events);
 const afterApply=await f.counts();for(const name of ['operators','oa_operators','rer_mail_development_outbox','vector_webhook_events','integration_deliveries','agent_dispatches'])if(name in before)expect(afterApply[name],name).toBe(before[name]);
 expect(await env.DB.prepare('SELECT count(*) n FROM issue_dependencies WHERE blocked_issue_id=? OR blocking_issue_id=?').bind(nativeSentinel.id,nativeSentinel.id).first<number>('n')).toBe(0);
 for(const query of ['VJ-1','vj-1','710001']){
  const lookup=await f.call('/issues/'+query);expect(lookup.status).toBe(200);expect(await lookup.json()).toMatchObject({id:rows[0].id,importedFrom:{sourceId:'710001',sourceKey:'VJ-1'}});
  const found=await (await f.call('/search?q='+query)).json() as {issues:{id:string}[]};expect(found.issues.filter(issue=>issue.id===rows[0].id)).toHaveLength(1);
 }
 // A changed key cannot create a second copy under an existing stable source ID.
 const renamed={...input,base64:Buffer.from(Buffer.from(input.base64,'base64').toString().replaceAll('VJ-1,','MOVED-1,')).toString('base64')};
 expect((await f.preview(renamed)).errors.some(item=>item.code==='source_content_conflict')).toBe(true);expect(await f.counts()).toEqual(afterApply);
 const edited=rows[40],commented=rows[41];
 expect((await f.call('/issues/'+edited.identifier,'PATCH',{expectedVersion:edited.version,title:'Native work after migration'})).status).toBe(200);
 expect((await f.call('/issues/'+commented.identifier+'/comments','POST',{body:'Later native comment'})).status).toBe(201);
 const conflict=await (await f.call('/data/import/runs/'+run.id+'/rollback')).json() as RollbackPreview;
 expect(conflict.conflicts.map(({identifier,reasons})=>({identifier,reasons}))).toEqual([{identifier:edited.identifier,reasons:['edited']},{identifier:commented.identifier,reasons:['commented']}].sort((a,b)=>a.identifier.localeCompare(b.identifier)));
 const beforeRefusal=await f.counts(),beforeRefusalSnapshot=await f.snapshots(),refused=await f.call('/data/import/runs/'+run.id+'/rollback','POST',{confirmed:true});expect(refused.status).toBe(409);expect((await refused.json() as {conflicts:unknown}).conflicts).toEqual(conflict.conflicts);expect(await f.counts()).toEqual(beforeRefusal);expect(await f.snapshots()).toEqual(beforeRefusalSnapshot);
 proof.editedRollback={allTableContentsUnchanged:true,conflicts:conflict.conflicts,before:beforeRefusal,after:await f.counts()};
 // Second run confirms attachment link opt-in and preserves the first run.
 const second=f.inputJira('jira-untouched',generateJiraFixture({sourceKeyPrefix:'VJ2'}).csv,true),secondReview=await f.preview(second);expect(secondReview.errors).toEqual([]);
 expect(secondReview.jiraReview!.concepts.find(item=>item.name==='attachment')!.occurrences.every(item=>item.action==='planned')).toBe(true);
 const secondApply=await f.apply(second,secondReview);expect(secondApply.status).toBe(200);const untouched=await f.finish(await secondApply.json());
 await checkJiraReconciliation(f,untouched.id,true,generateJiraFixture({sourceKeyPrefix:'VJ2'}));
 const removable=await (await f.call('/data/import/runs/'+untouched.id+'/rollback')).json() as RollbackPreview;expect(removable.conflicts).toEqual([]);expect(removable.issues).toBe(300);
 const beforeUndo=await f.counts(),cycleCount=await env.DB.prepare('SELECT count(*) n FROM issues WHERE id IN (SELECT target_id FROM ik_provenance WHERE job_id=?) AND cycle_id IS NOT NULL').bind(untouched.id).first<number>('n');
 const undo=await f.call('/data/import/runs/'+untouched.id+'/rollback','POST',{confirmed:true});expect(undo.status,await undo.clone().text()).toBe(200);expect((await f.finish(await undo.json())).state).toBe('rolled_back');
 const afterUndo=await f.counts(),deltas=Object.fromEntries(Object.keys(beforeUndo).filter(name=>beforeUndo[name]!==afterUndo[name]).map(name=>[name,beforeUndo[name]-afterUndo[name]]));
 const custody=(name:string)=>name.startsWith('ik_')||name==='vector_import_runs';
 const derived=(name:string)=>name.startsWith('search_issues')||name==='cycle_membership_events';
 expect(Object.fromEntries(Object.entries(deltas).filter(([name])=>!custody(name)&&!derived(name)))).toEqual(Object.fromEntries(Object.entries(removable.rows).filter(([,n])=>n>0)));
 expect(deltas.cycle_membership_events).toBe(-cycleCount!);
 expect((await f.report(untouched.id)).totals.issuesWritten).toBe(0);for(const count of Object.values((await f.report(untouched.id)).effects!.counts))expect(count.written).toBe(0);
 expect(await f.native(run.id)).toHaveLength(300);
 proof.wholeUndo={before:beforeUndo,after:afterUndo,deltas,removable:removable.rows,custodySurvivors:Object.fromEntries(Object.entries(afterUndo).filter(([name])=>custody(name)||name==='vector_import_reports'||name==='issue_prefix_sequences'))};
 // Invalid relationships and unsafe optional links refuse before native effects.
 const encode=(headers:string[],rows:string[][])=>[headers,...rows].map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n');
 const probeRows=f.fixture.rows.slice(0,3).map((row:string[])=>[...row]);
 const probe=async(rows:string[][],headers=f.fixture.headers,policy={})=>f.preview({...f.inputJira('jira-invalid',encode(headers,rows),true),jira:{...second.jira,...policy}});
 probeRows[0][14]='VJ-1';expect((await probe(probeRows)).errors.some(item=>item.code==='invalid_issue_reference')).toBe(true);
 probeRows[0][14]='VJ-2';probeRows[1][14]='710001';expect((await probe(probeRows)).errors.some(item=>item.code==='reference_cycle')).toBe(true);
 probeRows[0][14]='VJ-2';probeRows[1][14]='';probeRows[2][14]='';
 expect((await probe(probeRows.map((row:string[],i:number)=>[...row,i===0?'710003':'']),[...f.fixture.headers,'Parent id'])).errors.some(item=>item.code==='jira_conflicting_reference')).toBe(true);
 probeRows[0][14]='';probeRows[2][27]=probeRows[2][27].replace('https:','http:');expect((await probe(probeRows)).errors.some(item=>item.code==='unsafe_link')).toBe(true);
 probeRows[2][27]='';probeRows[2][13]='';expect((await probe(probeRows)).errors.some(item=>item.code==='jira_completion_policy_required')).toBe(true);
 const fallback=await probe(probeRows,undefined,{completedAtFallback:'updated'});expect(fallback.errors).toEqual([]);
 const changedPolicy=await f.apply({...second,jira:{...second.jira,attachmentLinks:false}},secondReview,'changed-attachment-policy');expect(changedPolicy.status).toBe(409);
 // Public authentication matrix on actual handlers, including a real minted token.
 const tokenResponse=await f.call('/settings/integrations/tokens','POST',{name:'Jira route probe',scopes:['issues:read','issues:write']});expect(tokenResponse.status).toBe(201);const token=(await tokenResponse.json() as {token:string}).token;
 const teammate=await invite('jira-removed@base.test',f.cookie),teammateId=await actor(teammate);expect((await f.call('/settings/operators/'+teammateId,'DELETE')).status).toBe(200);
 const app=createServerApp(),auth:Record<string,number>={};
 for(const [name,path,method,body] of [['preview','/preview','POST',input],['apply','/apply','POST',{}],['status','/runs/'+run.id,'GET',undefined],['resume','/runs/'+run.id+'/resume','POST',{}],['report','/runs/'+run.id+'/report','GET',undefined],['rollback','/runs/'+run.id+'/rollback','POST',{confirmed:true}]] as const){
  for(const [role,headers] of [['signed out',{origin}],['API token',{origin,authorization:'Bearer '+token}],['removed operator',{origin,cookie:teammate}],...(method==='POST'?[['cross origin',{origin:'https://other.example',cookie:f.cookie}]]:[])] as [string,Record<string,string>][]){
   auth[name+' '+role]=(await app.request(origin+'/api/data/import'+path,{method,headers:{host:new URL(origin).host,'content-type':'application/json',...headers},body:method==='POST'?JSON.stringify(body):undefined},bindings)).status;
   expect(auth[name+' '+role],name+' '+role).toBe(role==='cross origin'?403:401);
  }
 }
 Object.assign(proof,{auth,before,afterApply,reconciliation:{totals:report.totals,effects:report.effects,dimensions:report.dimensions}});
 await context.annotate(JSON.stringify(proof),'jira-apply-proof');
},600_000);
