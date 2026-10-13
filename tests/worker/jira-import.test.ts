import { env } from 'cloudflare:workers';
import { expect,it } from 'vitest';
import { Buffer } from 'node:buffer';
import { contractTitle } from '../contract-tags';
import { checkJiraLossReview } from './jira-loss-review-fixture';
import { setupImport } from './data-import-fixture';
import type { ImportInput } from '../../src/core/features/data/import/types';
import { previewSchema } from '../../src/core/features/data/ui/import-client';

it(contractTitle('DATA-009','Jira loss review counts every source concept and refuses unconfirmed mappings, omissions, ambiguous identities and dates before staged native writes'),async(context)=>{
 const f=await setupImport();
 for(const name of ['first','second'])await f.mutate('/settings/labels','POST',{name,color:'#234567'});
 const customColumns=['Custom field (Plugin)','constructor','__proto__','toString'];
 const headers=['Issue id','Issue key','Summary','Description','Status','Status Category','Priority','Assignee','Created','Updated','Due date','Resolved','Comment','Comment','Attachment','Attachment','Sprint','Sprint','Labels','Labels','Parent','Original estimate',...customColumns];
 const row=['10001','OLD-7','Quoted, Jira issue','First line\nSecond; line',f.status.name,'To Do','Highest','sarah@vector.test','01/02/2026 09:30','02/02/2026 10:00','03/02/2026','','13/02/2026 11:30;former;;First; comment','14/02/2026 12:30;other;Second comment','15/02/2026 13:30;former;one.txt;https://files.example.test/one','16/02/2026 14:30;other;two.txt;https://files.example.test/two','Sprint one','Sprint two','first','second','10000','3600',...customColumns.map(name=>'Retained '+name+' value')];
 const encode=(values:string[][])=>Buffer.from('\uFEFF'+values.map(cells=>cells.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n').toString('base64');
 const input:ImportInput={format:'jira-csv',source:'jira-site-a',name:'jira.csv',base64:encode([headers,row]),mapping:{},defaults:{team:f.team.id,status:f.status.id},references:{status:{[f.status.name]:f.status.id}},jira:{sourceOffset:'+10:00',priorities:{Highest:'urgent'}}};
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' AND name NOT IN ('access_rate_limits','oa_limits') ORDER BY name").all<{name:string}>()).results.map(row=>row.name);
 const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await env.DB.prepare('SELECT count(*) n FROM "'+table+'"').first<number>('n')])));
 const before=await counts(),effects=await f.effects();
 const review=await f.preview(input);
 expect(review.errors).toEqual([]);expect(review.ready).toBe(true);expect(review.count).toBe(1);
 expect(previewSchema.parse(review).jiraReview).toEqual(review.jiraReview);
 for(const name of customColumns)expect(review.jiraReview?.concepts.find(item=>item.name===name.toLowerCase())?.occurrences).toEqual([expect.objectContaining({column:headers.indexOf(name)+1,value:row[headers.indexOf(name)],action:'not_imported'})]);
 expect(review.headers.filter(header=>header==='Comment')).toHaveLength(2);
 expect(review.jiraDates).toMatchObject({pattern:'D/M/YYYY',sample:'01/02/2026 09:30',sourceOffset:'+10:00',cells:7});
 for(const name of ['Comment','Attachment'])expect(review.omissions.filter(item=>item.field?.startsWith(name+' [column '))).toHaveLength(2);
 expect(review.omissions.filter(item=>item.code==='jira_sprint_rollover')).toHaveLength(1);
 expect(review.omissions.filter(item=>item.code==='unresolved_sprint')).toHaveLength(1);
 expect(review.jiraReview?.concepts.find(item=>item.name==='labels')).toMatchObject({rowCount:1,valueCount:2});
 expect(review.jiraReview?.concepts.find(item=>item.name==='resolved')).toMatchObject({rowCount:0,valueCount:0});
 expect(review.omissions.some(item=>item.field?.startsWith('Original estimate'))).toBe(true);
 expect(review.omissions.some(item=>item.field?.startsWith('Issue key'))).toBe(true);
 expect(review.omissions.some(item=>item.code==='unresolved_assignee')).toBe(true); // An existing email must still be explicitly mapped.
 expect(await counts()).toEqual(before);
 // The quoted multiline description puts the next record at physical row 4.
 for(const key of ['OLD-7',' old-7 ']) {
  const second=[...row];second[0]='10002';second[1]=key;
  const conflicting={...input,base64:encode([headers,row,second])},conflict=await f.preview(conflicting);
  expect(conflict.ready).toBe(false);expect(conflict.count).toBe(2);
  expect(conflict.errors.filter(item=>item.code==='jira_ambiguous_issue_key').map(item=>({row:item.row,field:item.field}))).toEqual([{row:2,field:'issue key'},{row:4,field:'issue key'}]);
  for(const physicalRow of [2,4])expect(conflict.omissions.filter(item=>item.row===physicalRow).map(({row:_row,sourceId:_id,sourceKey:_key,...item})=>item)).toEqual(review.omissions.map(({row:_row,sourceId:_id,sourceKey:_key,...item})=>({...item,value:physicalRow===4&&item.field==='Issue key [column 2]'?key:item.value})));
  const refused=await f.apply(conflicting,{...conflict,fingerprint:review.fingerprint},'jira-key-conflict');
  expect(refused.status).toBe(400);expect((await refused.json() as {error:string}).error).toBe('import_preflight_failed');
  expect(await counts()).toEqual(before);expect(await f.effects()).toEqual(effects);
 }
 for(const copies of [2,3]) {
  const repeated={...input,base64:encode([headers,...Array.from({length:copies},()=>row)])},duplicate=await f.preview(repeated);
  const physicalRows=Array.from({length:copies},(_,index)=>2+index*2);
  expect(duplicate.ready).toBe(false);expect(duplicate.count).toBe(copies);
  expect(duplicate.errors.filter(item=>item.code==='jira_duplicate_source_id').map(item=>({row:item.row,field:item.field}))).toEqual(physicalRows.map(row=>({row,field:'issue id'})));
  expect(duplicate.omissions).toHaveLength(review.omissions.length*copies);
  for(const physicalRow of physicalRows)expect(duplicate.omissions.filter(item=>item.row===physicalRow).map(({row:_row,sourceId:_id,sourceKey:_key,...item})=>item)).toEqual(review.omissions.map(({row:_row,sourceId:_id,sourceKey:_key,...item})=>item));
  const refused=await f.apply(repeated,{...duplicate,fingerprint:review.fingerprint},'jira-duplicate-id');
  expect(refused.status).toBe(400);expect((await refused.json() as {error:string}).error).toBe('import_preflight_failed');
  expect(await counts()).toEqual(before);expect(await f.effects()).toEqual(effects);
 }
 const variant=async(change:(headers:string[],row:string[])=>void,config:Partial<ImportInput>={})=>{const names=[...headers],values=[...row];change(names,values);return f.preview({...input,...config,base64:encode([names,values])});};
 const ambiguous=await variant((_names,values)=>{for(let i=12;i<=15;i++)values[i]=values[i].replace(/^\d\d/,'04');});
 expect(ambiguous.ready).toBe(false);expect(ambiguous.errors.some(item=>item.code==='jira_ambiguous_dates')).toBe(true);
 const missing=await variant((names,values)=>{names.splice(0,1);values.splice(0,1);});
 expect(missing.errors.some(item=>item.code==='jira_required_column'&&item.field==='issue id')).toBe(true);
 const noOffset=await f.preview({...input,jira:{priorities:{Highest:'urgent'}}});
 expect(noOffset.errors.filter(item=>item.code==='jira_source_offset_required')).toHaveLength(6);
 const mixed=await variant((_names,values)=>{values[15]=values[15].replace('16/02/2026','02/16/2026');});
 expect(mixed.errors.some(item=>item.code==='jira_mixed_dates')).toBe(true);
 const impossible=await variant((_names,values)=>{values[13]=values[13].replace('14/02/2026','30/02/2026');});
 expect(impossible.errors.some(item=>item.code==='jira_invalid_date')).toBe(true);
 const mixedFamily=await variant((_names,values)=>{values[15]=values[15].replace('16/02/2026','2026-02-16');});
 expect(mixedFamily.errors.some(item=>item.code==='jira_mixed_dates')).toBe(true);
 const month=await variant((_names,values)=>{for(let i=8;i<=15;i++)values[i]=values[i].replace('/02/','/Feb/');});
 expect(month.errors).toEqual([]);expect(month.jiraDates?.pattern).toBe('D/Mon/YYYY');
 const iso=await variant((_names,values)=>{for(let i=8;i<=15;i++)values[i]=values[i].replace(/(\d\d)\/02\/2026/,'2026-02-$1');});
 expect(iso.errors).toEqual([]);expect(iso.jiraDates?.pattern).toBe('YYYY-MM-DD');
 const shortRow=row.map(value=>value.replace(/\/02\/2026/g,'/Feb/26'));
 shortRow[8]='01/Feb/26 12:00 AM+02:00';shortRow[9]='02/Feb/26 12:00 PM';
 const shortInput={...input,source:'jira-short-year',base64:encode([headers,shortRow]),jira:{...input.jira,shortYearCentury:2000}};
 const shortReview=await f.preview(shortInput);expect(shortReview.errors).toEqual([]);expect(shortReview.jiraDates).toMatchObject({pattern:'D/Mon/YY',shortYearCentury:2000});
 const noCentury=await f.preview({...shortInput,jira:input.jira});expect(noCentury.errors.filter(item=>item.code==='jira_short_year_century_required')).toHaveLength(7);
 const badClock=[...shortRow];badClock[8]='01/Feb/26 13:00 PM';
 expect((await f.preview({...shortInput,base64:encode([headers,badClock])})).errors.some(item=>item.code==='jira_invalid_date')).toBe(true);
 const unconfirmed=await f.preview({...input,references:{},jira:{sourceOffset:'+10:00'}});
 expect(unconfirmed.errors.some(item=>item.field==='status')).toBe(true);expect(unconfirmed.errors.some(item=>item.field==='priority')).toBe(true);
 expect((await f.call('/data/import/apply','POST',{input:{...input,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'jira-unacknowledged',acknowledgeOmissions:false})).status).toBe(400);
 for(const format of ['csv','linear-csv'] as const)expect((await f.call('/data/import/preview','POST',{...input,format,jira:undefined})).status).toBe(400);
 expect(await counts()).toEqual(before);
 const applied=await f.apply(input,review);expect(applied.status,await applied.clone().text()).toBe(200);
 const run=await f.finish(await applied.json());expect(run.state).toBe('completed');
 const issue=await env.DB.prepare('SELECT * FROM issues').first();
 expect(issue).toMatchObject({title:row[2],description:row[3],priority:'urgent',assignee_operator_id:null,created_at:'2026-01-31T23:30:00.000Z',updated_at:'2026-02-02T00:00:00.000Z',due_date:'2026-02-03',estimate:null});
 const identities=(await env.DB.prepare("SELECT json_extract(record_json,'$.sourceId') id FROM ik_provenance WHERE reversed=0").all()).results;
 expect(identities).toEqual([{id:'10001'}]);
 const originals=await (await f.call('/data/import/runs/'+run.id+'/originals')).json() as {original:{base64:string}}[];
 expect(originals[0].original.base64).toBe(input.base64);
 const publishedCounts=await counts(),changed=[...row];changed[2]='Changed retained source';
 const changedInput={...input,base64:encode([headers,changed,changed])},changedReview=await f.preview(changedInput);
 expect(changedReview.ready).toBe(false);
 expect(changedReview.errors.filter(item=>item.code==='source_content_conflict').map(item=>item.row)).toEqual([2,4]);
 const unsupported=review.omissions.filter(item=>item.code==='jira_not_imported'||item.code==='jira_sprint_rollover').map(({row:_row,sourceId:_id,sourceKey:_key,...item})=>item);
 for(const physicalRow of [2,4])expect(changedReview.omissions.filter(item=>item.row===physicalRow).map(({row:_row,sourceId:_id,sourceKey:_key,...item})=>item)).toEqual(unsupported);
 expect((await f.apply(changedInput,{...changedReview,fingerprint:review.fingerprint},'jira-retained-conflict')).status).toBe(409);
 expect(await counts()).toEqual(publishedCounts);
 expect((await f.apply(input,review)).status).toBe(200);expect((await counts()).issues).toBe(1);
 const status=await f.call('/data/import/runs/'+run.id);expect(status.status).toBe(200);
 const report=await (await f.call('/data/import/runs/'+run.id+'/report')).json() as {totals:{issuesWritten:number};omitted:{field:string;count:number}[];jiraReview:unknown};
 expect(report.totals.issuesWritten).toBe(1);expect(report.omitted.filter(item=>item.field?.startsWith('Comment [column '))).toHaveLength(2);
 expect(report.jiraReview).toEqual(review.jiraReview);
 const rollback=await f.call('/data/import/runs/'+run.id+'/rollback','POST',{confirmed:true});expect(rollback.status).toBe(200);await f.finish(await rollback.json());
 // Identifier reservations changed during the first run; review the second run again.
 const freshShortReview=await f.preview(shortInput);expect(freshShortReview.errors).toEqual([]);
 const shortApply=await f.apply(shortInput,freshShortReview);expect(shortApply.status).toBe(200);const shortRun=await f.finish(await shortApply.json());
 expect(await env.DB.prepare('SELECT created_at,updated_at FROM issues').first()).toEqual({created_at:'2026-01-31T22:00:00.000Z',updated_at:'2026-02-02T02:00:00.000Z'});
 const shortRollback=await f.call('/data/import/runs/'+shortRun.id+'/rollback','POST',{confirmed:true});expect(shortRollback.status).toBe(200);await f.finish(await shortRollback.json());
 const after=await counts();for(const table of tables.filter(table=>table==='issues'||(table.startsWith('issue_')&&table!=='issue_prefix_sequences')))expect(after[table],table).toBe(before[table]);
 expect(after.issue_prefix_sequences).toBe(1); // Never recycle native identifiers after rollback.
 expect(await f.effects()).toEqual(effects);
 await context.annotate(JSON.stringify(await checkJiraLossReview(f)),'jira-review-proof');
 // Exact originals, source identity, native effects and rollback are asserted above.
},180_000);
