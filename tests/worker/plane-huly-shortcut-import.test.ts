import { Buffer } from 'node:buffer';
import { expect,it } from 'vitest';
import plane from '../fixtures/import/plane.csv?raw';
import huly from '../fixtures/import/huly.json?raw';
import shortcut from '../fixtures/import/shortcut.csv?raw';
import { setupImport } from './data-import-fixture';
import type { ImportInput } from '../../src/core/features/data/import/types';
import type { ImportReport } from '../../src/core/features/data/import/report';

const cases=[
  {format:'plane-csv',name:'plane.csv',text:plane,ids:['ENG-42','ENG-43'],omitted:1,reason:'plane_comments_unsupported',parents:1},
  {format:'huly-json',name:'huly.json',text:huly,ids:['huly-issue-1','huly-issue-2'],omitted:5,reason:'huly_hours_not_points',parents:0},
  {format:'shortcut-csv',name:'shortcut.csv',text:shortcut,ids:['101','102'],omitted:1,reason:'shortcut_list_encoding_unverified',parents:0},
] as const;
it.each(cases)('[DATA-015] $format imports its source fixture through reviewed staged runs and reconciles mapped fields and explicit losses',async(c)=>{
  const f=await setupImport();
  const input:ImportInput={format:c.format,source:c.format,name:c.name,base64:Buffer.from(c.text).toString('base64'),mapping:{},defaults:{team:f.team.id},references:{status:{Ready:f.status.id}}};
  const invalidText=c.format==='plane-csv'?c.text.replace('Fri, 30 Oct 2026','Mon, 30 Oct 2026'):c.format==='huly-json'?c.text.replace('tracker:class:Issue','task:class:Task'):c.text.replace('high,3,','high,3.5,');
  const invalid=await f.preview({...input,base64:Buffer.from(invalidText).toString('base64')});
  expect(invalid.ready).toBe(false);expect(invalid.errors.some(error=>error.row===1||error.row===2)).toBe(true);
  const review=await f.preview(input);
  expect(review.errors).toEqual([]);expect(review.ready).toBe(true);expect(review.count).toBe(2);
  expect(review.omissions).toHaveLength(c.omitted);expect(review.omissions.some(o=>o.code===c.reason)).toBe(true);
  const denied=await f.call('/data/import/apply','POST',{input:{...input,effectiveAt:review.effectiveAt},reviewedFingerprint:review.fingerprint,operationKey:'unreviewed',acknowledgeOmissions:false});
  expect(denied.status).toBe(400);
  const applied=await f.apply(input,review);expect(applied.status,await applied.clone().text()).toBe(200);
  const run=await f.finish(await applied.json());expect(run.state).toBe('completed');
  expect(await (await f.apply(input,review)).json()).toMatchObject({id:run.id,state:'completed'});
  const response=await f.call('/data/import/runs/'+run.id+'/report');expect(response.status).toBe(200);
  const report=await response.json() as ImportReport;
  expect(report.totals).toMatchObject({rowsRead:2,issuesWritten:2,rowsNotWritten:0,omittedValues:c.omitted,unresolvedReferences:0});
  expect(report.mapping.map(m=>m.sourceId).sort()).toEqual([...c.ids].sort());
  expect(report.omitted.reduce((sum,o)=>sum+o.count,0)).toBe(c.omitted);
  expect(report.omitted.find(o=>o.code===c.reason)?.count).toBe(1);
  expect(report.dimensions.status).toEqual([{source:'Ready',read:2,written:2,vector:[{name:f.status.name,count:2}]}]);
  expect(report.effects?.counts.parents).toEqual({planned:c.parents,written:c.parents});
  for(const [index,id] of c.ids.entries()){
    const identifier=report.mapping.find(m=>m.sourceId===id)!.identifier!;
    const issue=await (await f.call('/issues/'+identifier)).json() as {title:string;description:string;priority:string;estimate:number|null;dueDate:string|null;parent:{identifier:string}|null};
    expect(issue).toMatchObject({title:index===0?'Review delivery':'Publish notes',description:index===0?'Check the delivery details.':'Write the release notes.',priority:index===0?'high':'low',estimate:c.format==='huly-json'?null:index===0?3:5,dueDate:c.format==='huly-json'?null:index===0?'2026-10-30':'2026-11-02'});
    if(c.parents&&index===1)expect(issue.parent?.identifier).toBe(report.mapping.find(m=>m.sourceId===c.ids[0])!.identifier);
  }
  const undone=await f.call('/data/import/runs/'+run.id+'/rollback','POST',{confirmed:true});expect(undone.status).toBe(200);
  expect((await f.finish(await undone.json())).state).toBe('rolled_back');
  const after=await (await f.call('/data/import/runs/'+run.id+'/report')).json() as ImportReport;expect(after.totals.issuesWritten).toBe(0);
});
