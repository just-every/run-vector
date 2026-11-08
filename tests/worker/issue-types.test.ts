import { typedUndoJourney } from './issue-types-recovery'
import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { roleWorkspace, resetLimits, snapshot } from './role-fixture'
import { json } from './custom-fields-journey'
import { severityArchive } from './custom-fields-writers'
import { agentRequest, agentToolClient } from './agent-resource-journey'
import { beforeCommit } from './removal-interleaving'
import { request } from './base-auth-fixture'
import { origin } from './base-auth-fixture'

const tables=['issues','issue_activity','issue_types','issue_type_required_fields','custom_field_definitions','custom_field_options','teams','team_issue_sequences','issue_followers','notifications']
it('team issue types retain identity, enforce required Severity at every native writer, keep off history and group saved lists with exact counts',async()=>{
 const w=await roleWorkspace(),{owner,admin,member,lead,guest}=w.people
 const viewer=await w.fresh('member')
 await json(owner.call(`/settings/operators/${viewer.id}/role`,'PATCH',{role:'viewer'}))
 const base=`/settings/teams/${w.team.id}/issue-types`
 const unchanged=async(run:()=>Promise<Response>,status:number)=>{
  await resetLimits();const before=await snapshot(tables);const response=await run()
  expect(response.status,await response.clone().text()).toBe(status)
  expect(await snapshot(tables)).toEqual(before)
 }
 for(const person of [admin,member,lead,guest,viewer]) await unchanged(()=>person.call(base,'PUT',{enabled:true}),403)
 const fieldState=await json(owner.call(`/settings/teams/${w.team.id}/custom-fields`,'POST',{name:'Severity',type:'single_select',options:[{name:'Minor'},{name:'Major'},{name:'Critical'}]}))
 const severity=fieldState.teams.find((t:any)=>t.id===w.team.id).customFields[0],major=severity.options[1].id
 const enabled=await json(owner.call(base,'PUT',{enabled:true}))
 expect(enabled.enabled).toBe(true);expect(enabled.types.map((t:any)=>[t.defaultKey,t.name,t.icon])).toEqual([
  ['bug','Bug','🐛'],['feature','Feature','✨'],['task','Task','☑️'],['epic','Epic','⚡']])
 const bug=enabled.types[0],feature=enabled.types[1]
 expect(bug.requiredFieldIds).toEqual([severity.id])
 for(const person of [admin,member,guest,viewer]) await unchanged(()=>person.call(base+'/'+bug.id,'PATCH',{expectedVersion:1,name:'Defect',icon:'🔴'}),403)
 const renamed=await json(owner.call(base+'/'+bug.id,'PATCH',{expectedVersion:1,name:'Defect',icon:'🔴'}))
 expect(renamed.types[0]).toMatchObject({id:bug.id,name:'Defect',icon:'🔴',version:2,requiredFieldIds:[severity.id]})
 await unchanged(()=>owner.call(base+'/'+bug.id,'PATCH',{expectedVersion:1,name:'Old'}),409)
 const create=(call=owner.call,extra:Record<string,unknown>={})=>call('/issues','POST',{title:'synthetic-vector-typed',teamId:w.team.id,issueTypeId:bug.id,...extra})
 await unchanged(()=>create(),400)
 await unchanged(()=>create(member.api),400)
 const fields={[severity.id]:major}
 const issue=await json(create(member.api,{customFields:fields}),201)
 expect(issue).toMatchObject({issueTypeId:bug.id,issueTypesEnabled:true,issueType:{id:bug.id,name:'Defect',icon:'🔴'},customFields:fields})
 const patch=(call=owner.call,extra:Record<string,unknown>={})=>call('/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,customFields:{[severity.id]:null},...extra})
 await unchanged(()=>patch(),400)
 await unchanged(()=>patch(member.api),400)
 await unchanged(()=>patch(viewer.call),403)
 await unchanged(()=>owner.call('/issues/bulk','POST',{issues:[{identifier:issue.identifier,expectedVersion:issue.version}],changes:{customFields:{}}}),400)
 const plain=await json(owner.call('/issues','POST',{title:'synthetic-vector-plain',teamId:w.team.id}),201)
 await unchanged(()=>owner.call('/issues/bulk','POST',{issues:[{identifier:plain.identifier,expectedVersion:plain.version},{identifier:issue.identifier,expectedVersion:issue.version}],changes:{issueTypeId:bug.id,customFields:{}}}),400)
 await unchanged(()=>owner.call('/issues/'+plain.identifier,'PATCH',{expectedVersion:plain.version,issueTypeId:bug.id}),400)
 const typed=await json(owner.call('/issues/'+plain.identifier,'PATCH',{expectedVersion:plain.version,issueTypeId:feature.id}))
 expect(typed.issueTypeId).toBe(feature.id)
 // The owner can require a field after a request admitted its old optional state.
 // The pending clear must recheck that association in its own transaction.
 const withSeverity=await json(member.call('/issues/'+typed.identifier,'PATCH',{expectedVersion:typed.version,customFields:fields}))
 let concurrent:Awaited<ReturnType<typeof snapshot>>|undefined
 const racing=beforeCommit(sql=>sql.includes('UPDATE issues SET'),async()=>{
  await json(owner.call(base+'/'+feature.id,'PATCH',{expectedVersion:1,requiredFieldIds:[severity.id]}))
  concurrent=await snapshot(tables)
 })
 const raced=await request('/api/issues/'+typed.identifier,'PATCH',{expectedVersion:withSeverity.version,customFields:{}},member.cookie,{DB:racing})
 expect(raced.status,await raced.clone().text()).toBe(400)
 expect(concurrent).toBeDefined();expect(await snapshot(tables)).toEqual(concurrent)
 await json(owner.call(base+'/'+feature.id,'PATCH',{expectedVersion:2,requiredFieldIds:[]}))
 expect(await json(member.call('/issues/bulk','POST',{issues:[{identifier:typed.identifier,expectedVersion:withSeverity.version}],changes:{issueTypeId:feature.id,customFields:fields}}))).toMatchObject({changed:1})
 // Setting a type follows ordinary issue-edit cells, including invited Guests.
 const roleIssue=await json(owner.call('/issues','POST',{title:'synthetic-vector-role-type',teamId:w.team.id}),201)
 const guestType=await json(guest.call('/issues/'+roleIssue.identifier,'PATCH',{expectedVersion:roleIssue.version,issueTypeId:enabled.types[2].id}))
 const adminType=await json(admin.call('/issues/'+roleIssue.identifier,'PATCH',{expectedVersion:guestType.version,issueTypeId:enabled.types[3].id}))
 expect(adminType.issueTypeId).toBe(enabled.types[3].id)
 await unchanged(()=>viewer.call('/issues/'+roleIssue.identifier,'PATCH',{expectedVersion:adminType.version,issueTypeId:null}),403)
 const otherState=await json(owner.call('/settings/teams','POST',{name:'synthetic-vector-other-types',identifierPrefix:'TYPEB'}))
 const other=otherState.teams.find((t:any)=>t.identifierPrefix==='TYPEB')
 const otherTypes=await json(owner.call(`/settings/teams/${other.id}/issue-types`,'PUT',{enabled:true}))
 await unchanged(()=>create(owner.call,{issueTypeId:otherTypes.types[1].id,customFields:fields}),400)
 await unchanged(()=>patch(owner.call,{issueTypeId:otherTypes.types[1].id,customFields:fields}),400)
 // Every existing creator or field writer shares the required-value admission.
 const template=await json(owner.call('/issue-templates','POST',{name:'synthetic-vector-typed-template',teamId:w.team.id,defaults:{priority:'high'}}),201)
 const apply=(customFields:Record<string,unknown>)=>create(member.call,{templateId:template.id,templateVersion:template.version,customFields})
 await unchanged(()=>apply({}),400)
 expect(await json(apply(fields),201)).toMatchObject({issueTypeId:bug.id,customFields:fields,priority:'high'})
 await resetLimits()
 await json(agentRequest('/agents/api/policy',{method:'PUT',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',reviewers:['person:'+owner.id],rules:[{id:'standard',class:'standard',do:'autonomous'},{id:'rest',class:'*',do:'blocked'}],spend:{none:true}}})}))
 const grant=await json(member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-types-agent',scopes:['issues:write']}),201),tool=agentToolClient(grant.token)
 const beforeTool=await snapshot(tables)
 const edit=await tool('vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:issue.version,customFields:{}},expected_revision:issue.version,idempotency_key:crypto.randomUUID()})
 expect(JSON.stringify(edit.body)).toContain('invalid_option');expect(await snapshot(tables)).toEqual(beforeTool)
 const created=await tool('vector.issue.creation',{title:'synthetic-vector-agent-bug',teamId:w.team.id,issueTypeId:bug.id,idempotency_key:crypto.randomUUID()})
 // Tool names and the offered schema are exercised by the existing agent suite too.
 expect(JSON.stringify(created.body)).toContain('invalid_option');expect(await snapshot(tables)).toEqual(beforeTool)
 const minor=severity.options[0].id
 await tool('vector.issue.concurrent_edits',{identifier:issue.identifier,change:{expectedVersion:issue.version,customFields:{[severity.id]:minor}},expected_revision:issue.version,idempotency_key:crypto.randomUUID()})
 const agentWritten=await json(member.call('/issues/'+issue.identifier))
 expect(agentWritten.customFields).toEqual({[severity.id]:minor});expect(agentWritten.version).toBe(issue.version+1)
 issue.version=agentWritten.version;fields[severity.id]=minor
 const copyBody={expectedVersion:issue.version}
 const same=await json(owner.call('/issues/'+issue.identifier+'/copy','POST',copyBody),201)
 expect(same.issue).toMatchObject({issueTypeId:bug.id,customFields:fields});expect(same.droppedValues).toEqual([])
 await unchanged(()=>owner.call('/issues/'+issue.identifier+'/copy','POST',{...copyBody,customFields:{}}),400)
 const cross=await json(owner.call('/issues/'+issue.identifier+'/copy','POST',{...copyBody,teamId:other.id}),201)
 expect(cross.issue.issueTypeId).toBeNull();expect(cross.droppedValues).toContainEqual(expect.objectContaining({field:'issueTypeId',value:bug.id}))
 const mapped=await json(owner.call('/issues/'+issue.identifier+'/copy','POST',{...copyBody,teamId:other.id,issueTypeId:otherTypes.types[1].id}),201)
 expect(mapped.issue.issueTypeId).toBe(otherTypes.types[1].id)
 // Group counts cover the full result, independent of page membership or duplicate labels.
 await json(owner.call(`/settings/teams/${other.id}/issue-types/${otherTypes.types[1].id}`,'PATCH',{expectedVersion:1,name:'Defect',icon:'🔵'}))
 for(let i=0;i<51;i++)await json(member.call('/issues','POST',{title:'synthetic-vector-page-'+i,teamId:w.team.id,issueTypeId:feature.id}),201)
 const grouped=await json(member.api('/issues?grouping=issueType'))
 expect(grouped.allGroups).toEqual(expect.arrayContaining([expect.objectContaining({key:bug.id,name:'Defect',count:3}),expect.objectContaining({key:otherTypes.types[1].id,name:'Defect',count:1})]))
 expect(grouped.allGroups).toContainEqual(expect.objectContaining({key:feature.id,count:52}))
 const secondPage=await json(member.api('/issues?grouping=issueType&offset=50&revision='+encodeURIComponent(grouped.revision)))
 expect(new Set([...grouped.issues,...secondPage.issues].map((i:any)=>i.id)).size).toBe(grouped.total)
 expect(secondPage.allGroups).toEqual(grouped.allGroups)
 expect(grouped.allGroups.reduce((n:number,g:any)=>n+g.count,0)).toBe(grouped.total)
 const filtered=await json(member.api('/issues?issueType='+bug.id+'&grouping=issueType'))
 expect(filtered.total).toBe(3);expect(filtered.issues.every((i:any)=>i.issueType.id===bug.id)).toBe(true)
 const view=await json(member.call('/views','POST',{name:'synthetic-vector-types-view',isShared:true,query:{issueType:bug.id,grouping:'issueType'}}),201)
 expect((await json(member.call('/views/'+view.id))).query).toMatchObject({issueType:bug.id,grouping:'issueType'})
 await json(owner.call(`/settings/teams/${other.id}/privacy`,'PUT',{isPrivate:true}))
 await unchanged(()=>member.call('/issues/'+mapped.issue.identifier),404)
 const privateGroups=await json(member.api('/issues?grouping=issueType'))
 expect(privateGroups.allGroups.some((group:any)=>group.key===otherTypes.types[1].id)).toBe(false)
 expect((await json(member.api('/issues?issueType='+otherTypes.types[1].id))).total).toBe(0)
 expect((await json(guest.api('/issues?grouping=issueType'))).issues.every((issue:any)=>issue.team.id===w.team.id)).toBe(true)
 const disabled=await json(owner.call(base,'PUT',{enabled:false}))
 expect(disabled.types.map((t:any)=>t.id)).toEqual(enabled.types.map((t:any)=>t.id))
 const hidden=await json(member.call('/issues/'+issue.identifier))
 expect(hidden).toMatchObject({issueTypesEnabled:false,issueTypeId:bug.id,issueType:null})
 expect(hidden.activity).toContainEqual(expect.objectContaining({kind:'issue.types_disabled',previousValue:expect.objectContaining({issueTypeId:bug.id,name:'Defect'})}))
 await unchanged(()=>owner.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,issueTypeId:null}),400)
 expect((await json(member.api('/issues?issueType='+bug.id))).total).toBe(0)
 await json(owner.call(base,'PUT',{enabled:true}))
 expect(await json(member.call('/issues/'+issue.identifier))).toMatchObject({issueTypeId:bug.id,issueType:{name:'Defect'}})
 await json(owner.call(`/settings/teams/${other.id}/issue-types`,'PUT',{enabled:false}))
 await typedUndoJourney(w)
 await severityArchive(w,[issue.id,same.issue.id])
 const {destination}=await import('./http-archive-fixture')
 for(const id of [issue.id,same.issue.id,mapped.issue.id]) {
  const typeOf=(db:D1Database)=>db.prepare('SELECT issue_type_id FROM issues WHERE id=?').bind(id).first('issue_type_id')
  expect(await typeOf(destination.ARCHIVE_TARGET_DB)).toBe(await typeOf(env.DB))
 }
 expect(await destination.ARCHIVE_TARGET_DB.prepare('SELECT issue_types_enabled FROM teams WHERE id=?').bind(other.id).first('issue_types_enabled')).toBe(0)
 for(const table of ['issue_types','issue_type_required_fields']) {
  const {destination}=await import('./http-archive-fixture')
  expect((await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM '+table+(table==='issue_types'?' ORDER BY id':' ORDER BY type_id,field_id')).all()).results).toEqual((await env.DB.prepare('SELECT * FROM '+table+(table==='issue_types'?' ORDER BY id':' ORDER BY type_id,field_id')).all()).results)
 }
},240_000)
