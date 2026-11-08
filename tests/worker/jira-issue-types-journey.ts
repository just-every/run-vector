import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import { Buffer } from 'node:buffer'
import type { ImportInput } from '../../src/core/features/data/import/types'
import type { setupImport } from './data-import-fixture'

/** Story and Bug use explicit native identities; the reviewed required Severity
 * cell is refused before any reservation, and reconciliation retains every row. */
export async function jiraIssueTypesJourney(f:Awaited<ReturnType<typeof setupImport>>) {
 const call=f.call
 const send=async(path:string,method='GET',body?:unknown,status=200)=>{
  const response=await call(path,method,body);expect(response.status,await response.clone().text()).toBe(status);return await response.json() as any
 }
 const fields=await send(`/settings/teams/${f.team.id}/custom-fields`,'POST',{name:'Severity',type:'single_select',options:[{name:'Minor'},{name:'Major'},{name:'Critical'}]})
 const severity=fields.teams.find((t:any)=>t.id===f.team.id).customFields[0]
 const enabled=await send(`/settings/teams/${f.team.id}/issue-types`,'PUT',{enabled:true})
 const bug=enabled.types.find((t:any)=>t.defaultKey==='bug'),feature=enabled.types.find((t:any)=>t.defaultKey==='feature')
 const encode=(rows:string[][])=>Buffer.from(rows.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n')).toString('base64')
 const rows=[['Issue id','Issue key','Summary','Status','Issue Type','Custom field (Severity)'],
  ['synthetic-vector-story','OLD-201','synthetic-vector-story',f.status.name,'Story',''],
  ['synthetic-vector-bug','OLD-202','synthetic-vector-bug',f.status.name,'Bug','Major']]
 const input:ImportInput={format:'jira-csv',source:'synthetic-vector-typed-jira',name:'typed.csv',mapping:{},defaults:{team:f.team.id,status:f.status.id},references:{status:{[f.status.name]:f.status.id}},base64:encode(rows),jira:{issueTypes:{Story:feature.id,Bug:bug.id},customFields:{[severity.id]:{column:'Custom field (Severity)',options:{Major:severity.options[1].id}}}}}
 const before=await f.effects(),sequence=await env.DB.prepare('SELECT * FROM team_issue_sequences ORDER BY team_id').all()
 const missing=await f.preview({...input,jira:{issueTypes:input.jira!.issueTypes}})
 expect(missing.ready).toBe(false);expect(missing.errors).toContainEqual(expect.objectContaining({field:'issueType',message:expect.stringContaining('Severity')}))
 const noChoice=await f.preview({...input,jira:{...input.jira,issueTypes:{Story:feature.id}}})
 expect(noChoice.ready).toBe(false);expect(noChoice.errors).toContainEqual(expect.objectContaining({field:'issueType',message:expect.stringContaining('explicit mapping')}))
 expect((await f.apply({...input,jira:{issueTypes:input.jira!.issueTypes}},missing)).status).toBe(400)
 expect(await f.effects()).toEqual(before);expect((await env.DB.prepare('SELECT * FROM team_issue_sequences ORDER BY team_id').all()).results).toEqual(sequence.results)
 const review=await f.preview(input)
 expect(review.ready).toBe(true);expect(review.errors).toEqual([])
 expect(review.jiraReview?.issueTypes).toEqual([
  {source:'Story',rows:[2],categories:[],suggestion:null,target:feature.id},
  {source:'Bug',rows:[3],categories:[],suggestion:null,target:bug.id},
 ])
 expect(review.jiraReview?.concepts.find(c=>c.name==='issue type')).toMatchObject({rowCount:2,valueCount:2,dispositions:[expect.objectContaining({action:'planned',rowCount:2,valueCount:2})]})
 expect(review.omissions.some(o=>o.field?.startsWith('Issue Type')||o.field?.startsWith('Custom field (Severity)'))).toBe(false)
 const response=await f.apply(input,review);expect(response.status,await response.clone().text()).toBe(200)
 const run=await f.finish(await response.json());expect(run.state).toBe('completed')
 const imported=(await env.DB.prepare("SELECT title,issue_type_id,custom_fields_json FROM issues WHERE id IN (SELECT target_id FROM ik_provenance WHERE job_id=?) ORDER BY title").bind(run.id).all()).results
 expect(imported).toEqual([
  {title:'synthetic-vector-bug',issue_type_id:bug.id,custom_fields_json:JSON.stringify({[severity.id]:severity.options[1].id})},
  {title:'synthetic-vector-story',issue_type_id:feature.id,custom_fields_json:'{}'},
 ])
 const report=await send('/data/import/runs/'+run.id+'/report')
 expect(report.totals).toMatchObject({rowsRead:2,issuesWritten:2,rowsNotWritten:0,omittedValues:0})
 expect(report.jiraReview).toEqual(review.jiraReview)
 expect(report.effects.issueTypes).toEqual(expect.arrayContaining([
  {id:bug.id,name:'Bug',planned:1,written:1},{id:feature.id,name:'Feature',planned:1,written:1},
 ]))
 expect((await f.apply(input,review)).status).toBe(200)
 expect((await send('/data/import/runs/'+run.id+'/report')).totals.issuesWritten).toBe(2)
 const undo=await call('/data/import/runs/'+run.id+'/rollback','POST',{confirmed:true});expect(undo.status,await undo.clone().text()).toBe(200)
 await f.finish(await undo.json())
 expect((await send('/data/import/runs/'+run.id+'/report')).effects.issueTypes.every((type:any)=>type.written===0)).toBe(true)
 // Revoking type availability after review refuses publication without issue effects.
 const revoked={...input,source:'synthetic-vector-revoked-type'}
 const planned=await f.preview(revoked)
 await send(`/settings/teams/${f.team.id}/issue-types`,'PUT',{enabled:false})
 expect((await f.apply(revoked,planned)).status).toBe(400)
 await send(`/settings/teams/${f.team.id}/issue-types`,'PUT',{enabled:true})
}
