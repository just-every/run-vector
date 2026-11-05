import { it,expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { setupIntegrations } from './integration-fixture'
import { bindings,request,invite,actor } from './base-auth-fixture'
import { scheduled } from '../../src/core/app/scheduled'
import { beforeCommit } from './removal-interleaving'

it('[AUTO-001] weekly native series atomically commit one template graph, skip open work and stop under current authority',async()=>{
  const f=await setupIntegrations(),team=f.initial.teams[0]
  expect((await f.call('/settings','PATCH',{timezone:'America/New_York'})).status).toBe(200)
  const templateInput={name:'synthetic-vector-1710',teamId:team.id,defaults:{title:'synthetic-vector-1711',description:'## Weekly review',priority:'high',estimate:5},subissues:[{title:'synthetic-vector-1712'},{title:'synthetic-vector-1713'}]}
  const makeTemplate=async(input=templateInput)=>{
    const res=await f.call('/issue-templates','POST',input);expect(res.status,await res.clone().text()).toBe(201);return res.json() as Promise<any>
  }
  const projectState=await f.mutate('/settings/projects','POST',{name:'synthetic-vector-1725',leadOperatorId:f.owner})
  const project=projectState.projects.find(p=>p.name==='synthetic-vector-1725')!
  const labelState=await f.mutate('/settings/labels','POST',{name:'synthetic-vector-1726',color:'#52637a'})
  const label=labelState.labels.find(l=>l.name==='synthetic-vector-1726')!
  const template=await makeTemplate()
  const config={name:'synthetic-vector-1714',teamId:team.id,templateId:template.id,templateVersion:1,cadence:'weekly',startsOn:'2030-03-03',dueOffsetDays:2,skipWhileOpen:true,overrides:{title:'synthetic-vector-1715',description:'## Planned review',assigneeOperatorId:f.owner,priority:'urgent',estimate:8,statusId:team.statuses.find(s=>s.category==='started')!.id,projectId:project.id,labelIds:[label.id]}}
  const createSeries=async(extra:Record<string,unknown>={},call=f.call)=>{
    const res=await call('/recurring-issues','POST',{...config,...extra});expect(res.status,await res.clone().text()).toBe(201);return res.json() as Promise<any>
  }
  const series=await createSeries()
  expect(series).toMatchObject({configuringPersonId:f.owner,templateId:template.id,templateVersion:1,timezone:'America/New_York',state:'enabled',nextOn:'2030-03-03'})
  const read=async(id=series.id)=>{const res=await f.call('/recurring-issues/'+id);expect(res.status,await res.clone().text()).toBe(200);return res.json() as Promise<any>}
  const tick=(at:string,db=env.DB)=>scheduled({scheduledTime:Date.parse(at)},{...bindings,DB:db})
  // Compare recurrence effects; the real scheduled export also produces independent due reminders.
  const domain=async()=>Promise.all(['issues','issue_parents','issue_labels','issue_activity','issue_followers','notifications','notification_candidates'].map(async table=>({table,rows:(await env.DB.prepare('SELECT * FROM '+table+(table==='notifications'?' WHERE event_id IN(SELECT id FROM issue_activity)':'')+' ORDER BY rowid').all()).results})))
  await tick('2030-03-03T04:59:59Z');expect((await read()).history).toEqual([])
  await Promise.all([tick('2030-03-03T05:00:00Z'),tick('2030-03-03T05:00:00Z')])
  await tick('2030-03-06T15:00:00Z');f.restart()
  let state=await read();expect(state.history).toHaveLength(1)
  const receipt=state.history[0],parent=receipt.issue
  expect(receipt).toMatchObject({dueOn:'2030-03-03',scheduledAt:'2030-03-03T05:00:00.000Z',outcome:'created'})
  expect(parent.title).toBe('synthetic-vector-1715')
  expect(receipt.children.map((c:any)=>c.title).sort()).toEqual(['synthetic-vector-1712','synthetic-vector-1713'])
  const children=(await (await f.call('/issues/'+parent.identifier+'/subissues')).json() as any).children
  expect(children.map((c:any)=>c.id)).toEqual(expect.arrayContaining(receipt.children.map((c:any)=>c.id)))
  expect(new Set([parent.id,...children.map((c:any)=>c.id)]).size).toBe(3)
  const detail=await (await f.call('/issues/'+parent.identifier)).json() as any
  expect(detail).toMatchObject({description:'## Planned review',priority:'urgent',estimate:8,status:{id:config.overrides.statusId},assignee:{id:f.owner},project:{id:project.id},labels:[{id:label.id}],dueDate:'2030-03-05'})
  const provenance=await env.DB.prepare("SELECT next_value_json FROM issue_activity WHERE issue_id=? AND kind='issue.template_applied'").bind(parent.id).first<string>('next_value_json')
  expect(JSON.parse(provenance!)).toEqual({templateId:template.id,templateVersion:1})
  const graphBeforeSkip=await domain()
  await tick('2030-03-10T05:00:00Z');await tick('2030-03-12T15:00:00Z')
  expect(await domain()).toEqual(graphBeforeSkip)
  state=await read();expect(state.history.map((h:any)=>h.outcome)).toEqual(['skipped','created'])
  const completed=team.statuses.find(s=>s.category==='completed')!
  for(const issue of [...children,parent]) {
    const current=await (await f.call('/issues/'+issue.identifier)).json() as any
    const response=await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:current.version,statusId:completed.id})
    expect(response.status,await response.clone().text()).toBe(200)
  }
  await tick('2030-03-17T03:59:59Z');expect((await read()).history).toHaveLength(2)
  await tick('2030-03-17T04:00:00Z')
  state=await read();expect(state.history).toHaveLength(3);expect(state.history[0]).toMatchObject({scheduledAt:'2030-03-17T04:00:00.000Z',outcome:'created'})
  expect(state.history[0].issue.id).not.toBe(parent.id)
  expect(state.history[0].children.every((c:any)=>!receipt.children.some((old:any)=>old.id===c.id))).toBe(true)
  expect((await f.call('/recurring-issues/'+series.id,'PATCH',{expectedVersion:1,state:'paused'})).status).toBe(200)
  const paused=await domain();await tick('2030-03-24T04:00:00Z');expect(await domain()).toEqual(paused)
  expect((await f.call('/recurring-issues/'+series.id,'PATCH',{expectedVersion:2,state:'ended'})).status).toBe(200)
  expect((await f.call('/recurring-issues/'+series.id,'PATCH',{expectedVersion:3,state:'enabled'})).status).toBe(400)
  await tick('2031-03-24T04:00:00Z');expect(await domain()).toEqual(paused)

  const failure=await createSeries({name:'synthetic-vector-1716',startsOn:'2030-04-07'})
  await env.DB.prepare("CREATE TRIGGER synthetic_recurring_failure BEFORE INSERT ON issues WHEN NEW.title='synthetic-vector-1713' BEGIN SELECT RAISE(ABORT,'synthetic-storage-refusal'); END").run()
  const beforeFailure=await domain();await tick('2030-04-07T04:00:00Z')
  expect(await domain()).toEqual(beforeFailure)
  expect(await read(failure.id)).toMatchObject({lastError:'creation_failed',history:[{outcome:'failed',issue:null,children:[]}]})
  await env.DB.prepare('DROP TRIGGER synthetic_recurring_failure').run()
  await tick('2030-04-07T04:01:00Z');expect((await read(failure.id)).history).toMatchObject([{outcome:'created'}])
  expect((await f.call('/recurring-issues/'+failure.id,'PATCH',{expectedVersion:1,state:'ended'})).status).toBe(200)

  const stale=await createSeries({name:'synthetic-vector-1717',startsOn:'2030-05-05'})
  expect((await f.call('/issue-templates/'+template.id,'PUT',{...templateInput,expectedVersion:1})).status).toBe(200)
  const beforeStale=await domain();await tick('2030-05-05T04:00:00Z');expect(await domain()).toEqual(beforeStale)
  expect((await read(stale.id)).lastError).toBe('stale_template')
  expect((await f.call('/issue-templates/'+template.id,'DELETE',{expectedVersion:2})).status).toBe(200)
  await tick('2030-05-05T04:01:00Z');expect(await domain()).toEqual(beforeStale);expect((await read(stale.id)).lastError).toBe('not_found')
  expect((await f.call('/recurring-issues/'+stale.id,'PATCH',{expectedVersion:1,state:'ended'})).status).toBe(200)
  const freshTemplate=await makeTemplate()
  const member=await invite(['synthetic-vector-1718','example.test'].join('@'),f.cookie,'member'),memberId=await actor(member)
  expect((await f.call('/settings/teams/'+team.id+'/members/'+memberId,'PUT',{role:'member'})).status).toBe(200)
  const memberCall=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,member)
  const memberSeries=await createSeries({templateId:freshTemplate.id,name:'synthetic-vector-1719',startsOn:'2030-06-02'},memberCall)
  expect((await f.call('/settings/teams/'+team.id+'/members/'+memberId,'DELETE')).status).toBe(200)
  const beforeWithdrawal=await domain();await tick('2030-06-02T04:00:00Z');expect(await domain()).toEqual(beforeWithdrawal)
  expect((await read(memberSeries.id)).lastError).toBe('forbidden')
  expect((await f.call('/settings/operators/'+memberId,'DELETE')).status).toBe(200)
  await tick('2030-06-09T04:00:00Z');expect(await domain()).toEqual(beforeWithdrawal)
  expect((await f.call('/recurring-issues/'+memberSeries.id,'PATCH',{expectedVersion:1,state:'ended'})).status).toBe(200)

  const propertySeries=await createSeries({templateId:freshTemplate.id,name:'synthetic-vector-1727',startsOn:'2030-07-07'})
  expect((await f.call('/settings/labels/'+label.id,'DELETE')).status).toBe(200)
  const beforeProperty=await domain();await tick('2030-07-07T04:00:00Z');expect(await domain()).toEqual(beforeProperty)
  expect((await read(propertySeries.id)).lastError).toBe('invalid_option')
  expect((await f.call('/recurring-issues/'+propertySeries.id,'PATCH',{expectedVersion:1,state:'ended'})).status).toBe(200)
  // A stop wins even after a scheduler has planned the entire native graph.
  const pauseRace=await createSeries({templateId:freshTemplate.id,name:'synthetic-vector-1728',startsOn:'2030-08-04',overrides:{title:'synthetic-vector-1729'}})
  const pausedDuringCommit=beforeCommit(sql=>/insert into [`"]?issues/i.test(sql),async()=>{
    expect((await f.call('/recurring-issues/'+pauseRace.id,'PATCH',{expectedVersion:1,state:'paused'})).status).toBe(200)
  })
  const beforePauseRace=await domain();await tick('2030-08-04T04:00:00Z',pausedDuringCommit);expect(await domain()).toEqual(beforePauseRace)
  expect(await read(pauseRace.id)).toMatchObject({state:'paused',history:[]})

  // Session revocation and pause both win against a prepared creation transaction.
  const beforeRace=(await env.DB.prepare('SELECT * FROM recurring_issue_series ORDER BY id').all()).results
  const racing=beforeCommit(sql=>sql.includes('INSERT INTO recurring_issue_series'),async()=>{expect((await request('/auth/signout','POST',{},f.cookie)).status).toBe(204)})
  const response=await request('/api/recurring-issues','POST',{...config,templateId:freshTemplate.id,overrides:{title:'synthetic-vector-1730'}},f.cookie,{DB:racing})
  expect(response.status).toBe(401)
  expect((await env.DB.prepare('SELECT * FROM recurring_issue_series ORDER BY id').all()).results).toEqual(beforeRace)
},120000)
