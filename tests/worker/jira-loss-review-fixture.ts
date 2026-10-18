import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { generateJiraFixture } from '../fixtures/import/jira/generate.mjs';
import { invite,actor } from './base-auth-fixture';
import { holders } from './sentinel-scan';
import { setupImport } from './data-import-fixture';
import type { ImportInput,ImportPreview } from '../../src/core/features/data/import/types';
import { previewSchema } from '../../src/core/features/data/ui/import-client';

/** Part of the single DATA-009 route journey; expected counts come from the fixture, not the importer. */
export async function checkJiraLossReview(f:Awaited<ReturnType<typeof setupImport>>) {
 const fixture=generateJiraFixture(),expected=fixture.expected;
 for(const name of expected.nativeSetup.labels)await f.mutate('/settings/labels','POST',{name,color:'#345678'});
 for(const [index,name] of expected.nativeSetup.cycles.entries())await f.mutate('/settings/cycles','POST',{teamId:f.team.id,name,startsLocal:`2027-0${index+1}-01T09:00`,endsLocal:`2027-0${index+1}-20T09:00`,capacity:100});
 const inactive=await actor(await invite('jira-inactive@base.test',f.cookie));
 await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)").bind(inactive).run();
 const state=await f.state();
 const inputFor=(csv=fixture.csv):ImportInput=>({format:'jira-csv',source:'jira-300',name:'300.csv',base64:Buffer.from(csv).toString('base64'),mapping:{},defaults:{team:f.team.id},references:{status:Object.fromEntries([['To Do','unstarted'],['In Progress','started'],['Done','completed']].map(([name,category])=>[name,f.team.statuses.find(status=>status.category===category)!.id])),assignee:{[expected.nativeSetup.assigneeTokens[0].token]:f.owner},cycle:Object.fromEntries(state.cycles.map(cycle=>[cycle.name,cycle.id]))},jira:{priorities:expected.priorities.explicitVectorMapping}});
 const input=inputFor();
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' AND name NOT IN ('access_rate_limits','oa_limits') ORDER BY name").all<{name:string}>()).results.map(row=>row.name);
 const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await env.DB.prepare('SELECT count(*) n FROM "'+table+'"').first<number>('n')])));
 const sameNamedNative=await f.create({title:'Existing native source-reference sentinel'});
 const before=await counts(),effects=await f.effects();
 const review=await f.preview(input);expect(review.errors).toEqual([]);expect(review.ready).toBe(true);expect(review.count).toBe(300);
 expect(previewSchema.parse(review).jiraReview).toEqual(review.jiraReview); // Settings preserves the entire public loss review.
 const loss=review.jiraReview!;expect(loss).toBeDefined();
 expect(review.jiraDates).toMatchObject({pattern:'D/Mon/YYYY',cells:915});
 // CSV physical rows: the first issue's description and comment each span two lines.
 const rowOf=(index:number)=>index===0?2:index+4;
 for(const raw of expected.rawConceptCounts) {
  const concept=loss.concepts.find(item=>item.name===raw.header.toLowerCase())!;
  expect(concept,raw.header).toBeDefined();
  const occurrences=concept.occurrences.filter(item=>item.column===raw.position);
  expect(occurrences,raw.header).toHaveLength(raw.nonEmptyRows);
  expect(new Set(occurrences.map(item=>item.value)).size,raw.header).toBe(raw.distinctValues);
  const indexes=fixture.rows.flatMap((row:string[],index:number)=>row[raw.position-1]?[index]:[]);
  expect(occurrences.map(item=>item.row),raw.header).toEqual(indexes.map(rowOf));
  for(const occurrence of occurrences){const index=occurrence.row===2?0:occurrence.row-4;expect(occurrence).toMatchObject({sourceId:expected.sourceIds[index],sourceKey:expected.sourceKeys[index],value:fixture.rows[index][raw.position-1]});}
 }
 const concept=(name:string)=>loss.concepts.find(item=>item.name===name)!;
 for(const [name,rows,values] of [['sprint',151,176],['labels',161,172],['comment',95,102],['attachment',37,38]] as const)expect(concept(name)).toMatchObject({rowCount:rows,valueCount:values});
 expect(concept('sprint').occurrences.filter(item=>item.reason.startsWith('Rolled over'))).toHaveLength(25);
 expect(loss.unresolved.filter(item=>item.code==='unresolved_assignee').map(item=>({row:item.row,sourceId:item.sourceId,sourceKey:item.sourceKey,value:item.value}))).toEqual(Array.from({length:75},(_,n)=>{const index=4*n+1;return {row:rowOf(index),sourceId:expected.sourceIds[index],sourceKey:expected.sourceKeys[index],value:expected.nativeSetup.assigneeTokens[1].token};}));
 expect(loss.unresolved.filter(item=>item.code==='unresolved_sprint')).toEqual([expect.objectContaining({row:81,sourceId:'710078',sourceKey:'VJ-78',value:expected.nativeSetup.unmappedSprints[0]})]);
 expect(loss.unresolved.filter(item=>item.code==='terminal_cycle_omitted')).toHaveLength(25);
 expect(loss.unresolved.filter(item=>item.code==='jira_reference_outside_file')).toEqual([expect.objectContaining({row:14,sourceId:'710011',sourceKey:'VJ-11',value:'OUTSIDE-9001'})]);
 for(const name of ['comment','attachment'])for(const occurrence of concept(name).occurrences){const [time,author,...parts]=occurrence.value.split(';');expect(occurrence.action).toBe(name==='comment'?'planned':'not_imported');expect(occurrence.metadata).toEqual(name==='comment'?{time,author,body:parts.join(';')}:{time,author,filename:parts[0],url:parts.slice(1).join(';')});}
 expect(concept('original estimate').occurrences.filter(item=>item.action==='not_imported')).toHaveLength(60);
 expect(concept('issue type').occurrences.filter(item=>item.action==='planned').map(item=>item.row)).toEqual([2]);
 for(const name of ['parent','outward issue link (duplicate)','issue key'])expect(concept(name).occurrences.every(item=>item.action==='planned')).toBe(true);
 expect(concept('outward issue link (blocks)').occurrences.map(item=>item.action)).toEqual(['planned','planned','not_imported']);
 expect(concept('outward issue link (relates)').occurrences.every(item=>item.action==='planned')).toBe(true);
 expect(loss.statuses.map(item=>[item.source,item.suggestion,item.rows.length])).toEqual([['To Do','unstarted',100],['In Progress','started',100],['Done','completed',100]]);
 expect(loss.priorities.map(item=>[item.source,item.suggestion,item.rows.length])).toEqual([['Highest','urgent',60],['High','high',60],['Medium','medium',60],['Low','low',60],['Lowest','low',60]]);
 expect(await counts()).toEqual(before);
 const sameName=await f.preview(inputFor(fixture.csv.replace('OUTSIDE-9001',sameNamedNative.identifier)));
 expect(sameName.errors).toEqual([]);
 expect(sameName.jiraReview?.unresolved.filter(item=>item.code==='jira_reference_outside_file')).toEqual([expect.objectContaining({row:14,value:sameNamedNative.identifier})]);
 expect(await counts()).toEqual(before);
 const refuse=async(value:ImportInput,preview:ImportPreview,code:string)=>{const response=await f.apply(value,{...preview,fingerprint:review.fingerprint},'jira-refusal');expect(response.status).toBe(code==='import_review_changed'?409:400);expect(await response.json()).toMatchObject({error:code});expect(await counts()).toEqual(before);expect(await f.effects()).toEqual(effects);};
 for(const [variant,code] of [['unknown-status','invalid_field'],['ambiguous-numeric-dates','jira_ambiguous_dates'],['missing-required-column','jira_required_column']] as const) {
  const value=inputFor(generateJiraFixture({variant}).csv),preview=await f.preview(value);expect(preview.ready).toBe(false);
  if(variant==='unknown-status')expect(preview.errors.filter(item=>item.field==='status')).toEqual([expect.objectContaining({row:303,code,value:'Awaiting Product Review',sourceId:'710300',sourceKey:'VJ-300'})]);
  else if(variant==='missing-required-column')expect(preview.errors).toContainEqual(expect.objectContaining({row:1,field:'issue id',code}));
  else expect(preview.errors).toContainEqual(expect.objectContaining({row:0,code}));
  await refuse(value,preview,'import_preflight_failed');
 }
 const unconfirmed=await f.preview({...input,references:{...input.references,status:{}},jira:{}});expect(unconfirmed.errors.filter(item=>item.field==='status')).toHaveLength(300);expect(unconfirmed.errors.filter(item=>item.field==='priority')).toHaveLength(300);
 await refuse({...input,references:{...input.references,status:{}},jira:{}},unconfirmed,'import_preflight_failed');
 const noAck=await f.call('/data/import/apply','POST',{input:{...input,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'jira-no-ack-300',acknowledgeOmissions:false});expect(noAck.status).toBe(400);expect(await noAck.json()).toMatchObject({error:'import_omissions_unreviewed'});expect(await counts()).toEqual(before);
 for(const changed of [{...input,jira:{...input.jira,priorities:{...input.jira!.priorities,Highest:'low' as const}}},{...input,jira:{...input.jira,originalEstimateSecondsPerUnit:3600}}])await refuse(changed,{...review,effectiveAt:review.effectiveAt},'import_review_changed');
 // Explicit targets must be valid; no inferred account or cycle is accepted.
 const invalid={...input,references:{...input.references,assignee:{[expected.nativeSetup.assigneeTokens[0].token]:f.team.id},cycle:{[expected.nativeSetup.cycles[1]]:f.team.id}}};
 const invalidReview=await f.preview(invalid);expect(invalidReview.errors.filter(item=>item.field==='assignee')).toHaveLength(75);expect(invalidReview.errors.filter(item=>item.field==='cycle')).toHaveLength(75);await refuse(invalid,invalidReview,'import_preflight_failed');
 const inactiveInput={...input,references:{...input.references,assignee:{[expected.nativeSetup.assigneeTokens[0].token]:inactive}}};
 const inactiveReview=await f.preview(inactiveInput);expect(inactiveReview.errors.filter(item=>item.field==='assignee')).toHaveLength(75);await refuse(inactiveInput,inactiveReview,'import_preflight_failed');
 const wrongCycle={...input,references:{...input.references,cycle:{[expected.nativeSetup.cycles[1]]:state.cycles.find(cycle=>cycle.name===expected.nativeSetup.cycles[0])!.id}}};
 const wrongCycleReview=await f.preview(wrongCycle);expect(wrongCycleReview.errors.filter(item=>item.field==='cycle')).toHaveLength(75);await refuse(wrongCycle,wrongCycleReview,'import_preflight_failed');
 const missingLabel=inputFor(fixture.csv.replace('fixture-label-2','unknown-label'));
 const missingLabelReview=await f.preview(missingLabel);expect(missingLabelReview.errors.filter(item=>item.field==='labels')).toHaveLength(1);await refuse(missingLabel,missingLabelReview,'import_preflight_failed');
 // One real native apply proves automatic Epic labels and optional exact conversion.
 const csv=[fixture.headers,fixture.rows[0]].map((row:string[])=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n');
 const one={...inputFor(csv),source:'jira-epic-conversion',jira:{...input.jira,originalEstimateSecondsPerUnit:3600}};
 const fractional=await f.preview({...one,jira:{...one.jira,originalEstimateSecondsPerUnit:2400}});expect(fractional.errors.some(item=>item.field==='estimate')).toBe(true);await refuse({...one,jira:{...one.jira,originalEstimateSecondsPerUnit:2400}},fractional,'import_preflight_failed');
 const afterRefusals=await counts();expect(afterRefusals).toEqual(before);
 const oneReview=await f.preview(one);expect(oneReview.errors).toEqual([]);
 expect(oneReview.jiraReview?.concepts.find(item=>item.name==='original estimate')?.occurrences[0].action).toBe('planned');
 const applied=await f.apply(one,oneReview);expect(applied.status,await applied.clone().text()).toBe(200);const run=await f.finish(await applied.json());
 const native=await env.DB.prepare('SELECT id,estimate,assignee_operator_id,cycle_id FROM issues WHERE title=?').bind(fixture.rows[0][2]).first();expect(native).toMatchObject({estimate:1,assignee_operator_id:f.owner,cycle_id:state.cycles.find(cycle=>cycle.name===expected.nativeSetup.cycles[1])!.id});
 expect((await env.DB.prepare('SELECT l.name FROM issue_labels il JOIN labels l ON l.id=il.label_id WHERE il.issue_id=?').bind(native!.id).all()).results).toEqual([{name:'epic'}]);
 expect((await counts()).issue_comments).toBe(before.issue_comments!+1);
 for(const table of ['issue_links','issue_parents','issue_dependencies','issue_duplicates'])expect((await counts())[table]).toBe(before[table]);
 const afterApply=await counts();
 const report=await (await f.call('/data/import/runs/'+run.id+'/report')).json() as {jiraReview:unknown};expect(report.jiraReview).toEqual(oneReview.jiraReview);
 const rolled=await f.call('/data/import/runs/'+run.id+'/rollback','POST',{confirmed:true});expect(rolled.status).toBe(200);await f.finish(await rolled.json());
 const after=await counts();for(const table of tables.filter(table=>table==='issues'||(table.startsWith('issue_')&&table!=='issue_prefix_sequences')))expect(after[table],table).toBe(before[table]);expect(await f.effects()).toEqual(effects);
 const author=expected.nativeSetup.commentAuthorAccountId;
 expect((await holders(env.DB,[author])).vector_import_reports).toBeGreaterThan(0);
 const erasurePreview=await f.call('/data/erasure/preview','POST',{names:[author]});expect(erasurePreview.status).toBe(200);
 const erasure=await f.call('/data/erasure','POST',{subject:{names:[author]},confirmation:'erase '+author});expect(erasure.status,await erasure.clone().text()).toBe(200);
 expect(await holders(env.DB,[author])).toEqual({});
 expect((await (await f.call('/data/import/runs/'+run.id+'/report')).json() as {jiraReview?:unknown}).jiraReview).toBeUndefined();
 return {beforePreview:before,afterPreviewAndRefusals:afterRefusals,afterApply,afterRollback:after,concepts:loss.concepts.map(({name,rowCount,valueCount})=>({name,rowCount,valueCount})),measured:review.measured};
}
