import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import { actor, bindings, confirm, mailToken, request } from './base-auth-fixture'
import { afterNativeStatement } from './notification-session-fixture'
import { resetLimits, type roleWorkspace } from './role-fixture'
import { readPageResources } from '../../src/core/app/page-resources.server'
import { requireOperator } from '../../src/core/features/auth/service'

type Workspace = Awaited<ReturnType<typeof roleWorkspace>>
type Issue = { id:string; identifier:string; version:number }
async function json<T>(response:Response, status=200) {
  expect(response.status,await response.clone().text()).toBe(status)
  return response.json() as Promise<T>
}

/** One native journey: invite a Guest, convert a Member with a retained token,
 * read through every projection family, then withdraw team access. */
export async function guestVisibilityJourney(w:Workspace) {
  const owner=w.people.owner, member=w.people.member, guest=w.people.guest
  const outside=(await w.mutate('/settings/teams','POST',{name:'Guest hidden team',identifierPrefix:'GSHIDE'})).teams.find(t=>t.name==='Guest hidden team')!
  const project=await json<{id:string}>(await owner.api('/projects','POST',{name:'Guest mixed project',leadOperatorId:w.admin.id}),201)
  const hiddenProject=await json<{id:string}>(await owner.api('/projects','POST',{name:'Guest hidden project',leadOperatorId:owner.id}),201)
  const create=(title:string, teamId:string, projectId:string|null=null, assigneeOperatorId:string|null=null) =>
    owner.call('/issues','POST',{title,teamId,projectId,assigneeOperatorId}).then(r=>json<Issue>(r,201))
  const visible=await create('Guest visible bridge',w.team.id,project.id,member.id)
  const hidden=await create('Guest hidden bridge',outside.id,project.id,member.id)
  await create('Guest hidden project issue',outside.id,hiddenProject.id)
  const hiddenChild=await create('Guest hidden child',outside.id)
  const cycle=(name:string,teamId:string)=>owner.api('/cycles','POST',{name,teamId,startsLocal:'2034-01-02T09:00',endsLocal:'2034-01-06T09:00',capacity:20}).then(r=>json<{cycle:{id:string}}>(r,201)).then(r=>r.cycle.id)
  const visibleCycle=await cycle('Guest invited cycle',w.team.id), hiddenCycle=await cycle('Guest hidden cycle',outside.id)
  expect((await owner.call(`/issues/${visible.identifier}`,'PATCH',{expectedVersion:visible.version,cycleId:visibleCycle})).status).toBe(200)
  expect((await owner.call(`/issues/${hidden.identifier}`,'PATCH',{expectedVersion:hidden.version,cycleId:hiddenCycle})).status).toBe(200)
  const current=(id:string) => owner.call('/issues/'+id).then(r=>json<Issue>(r))
  expect((await owner.call(`/issues/${visible.identifier}/parent`,'PATCH',{expectedVersion:(await current(visible.identifier)).version,parentIdentifier:hidden.identifier})).status).toBe(200)
  expect((await owner.call(`/issues/${hiddenChild.identifier}/parent`,'PATCH',{expectedVersion:hiddenChild.version,parentIdentifier:visible.identifier})).status).toBe(200)
  expect((await owner.call(`/issues/${visible.identifier}/dependencies`,'POST',{expectedVersion:(await current(visible.identifier)).version,relatedIdentifier:hidden.identifier,relatedVersion:(await current(hidden.identifier)).version,direction:'blocked-by'})).status).toBe(200)
  const hiddenCopy=await json<{issue:Issue}>(await owner.call(`/issues/${visible.identifier}/copy`,'POST',{expectedVersion:(await current(visible.identifier)).version,teamId:outside.id}),201)
  const duplicate=await create('Guest visible duplicate',w.team.id)
  expect((await owner.call(`/issues/${duplicate.identifier}/duplicate`,'POST',{expectedVersion:duplicate.version,canonicalIdentifier:hidden.identifier})).status).toBe(200)
  const shared=await json<{id:string}>(await owner.call('/views','POST',{name:'Guest invited view',isShared:true,layout:'list',query:{team:w.team.id}}),201)
  const broad=await json<{id:string}>(await owner.call('/views','POST',{name:'Guest broad view',isShared:true,layout:'list',query:{}}),201)

  // An invitation carries named teams before confirmation; an actually invited
  // Guest has no token-mint door, independently of retained Member credentials.
  const email='native-guest@roles.test'
  expect((await w.people.admin.call('/settings/operators/invite','POST',{email,displayName:'Native guest',role:'guest',teamIds:[w.team.id]})).status).toBe(202)
  const invitedCookie=await confirm(await mailToken(email)), invitedId=await actor(invitedCookie)
  const invited=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,invitedCookie)
  const records=await json<{operators:{id:string;role:string;teamIds:string[];name:string}[]}>(await owner.call('/settings'))
  expect(records.operators.find(o=>o.id===invitedId)).toMatchObject({role:'guest',teamIds:[w.team.id],name:'Native guest (Guest)'})
  expect((await invited('/settings/integrations/tokens','POST',{name:'Forbidden',scopes:['issues:read']})).status).toBe(403)
  expect((await invited('/settings/operators/invite','POST',{email:'another@roles.test',displayName:'Another',role:'member'})).status).toBe(403)

  // A real role change restricts the already-open session and already-minted
  // token. The old hidden notification remains stored but is not projected.
  const memberPage=await json<{revision:string}>(await member.call('/issues'))
  expect((await w.people.admin.call(`/settings/operators/${member.id}/role`,'PATCH',{role:'guest',teamIds:[w.team.id]})).status).toBe(200)
  expect((await member.call('/issues?offset=1&revision='+encodeURIComponent(memberPage.revision))).status).toBe(409)
  const hiddenNotification=await env.DB.prepare('SELECT id FROM notifications WHERE issue_id=? AND recipient_id=?').bind(hidden.id,member.id).first<{id:string}>()
  expect(hiddenNotification).not.toBeNull()
  for (const who of [member,guest]) {
    for (const path of ['/issues','/issues?sort=priority&grouping=team','/current','/my-work','/my-work/activity','/search?q=Guest','/options','/mentions/options','/projects','/metadata','/notifications',`/cycles/${visibleCycle}`,'/workload?from=2026-01-01&to=2035-01-01',`/projects/${project.id}`,`/issues/${visible.identifier}`,`/issues/${visible.identifier}/subissues`,`/issues/${duplicate.identifier}`]) {
      await resetLimits()
      const response=await who.call(path), body=await response.text()
      expect(response.status,`${path}: ${body}`).toBe(200)
      for (const secret of [hidden.identifier,hiddenChild.identifier,hiddenCopy.issue.identifier,'Guest hidden bridge','Guest hidden child','Guest hidden project','Guest hidden cycle',outside.name])
        expect(body,`${path} disclosed ${secret}`).not.toContain(secret)
    }
    for (const path of [`/issues/${hidden.identifier}`,`/issues/${hidden.identifier}/discussion`,`/issues/${hidden.identifier}/description-history`,`/projects/${hiddenProject.id}`,`/views/${broad.id}`,`/teams/${outside.id}/subissue-rule`,`/cycles/${hiddenCycle}`])
      expect((await who.call(path)).status,path).toBe(404)
    expect((await who.call(`/views/${shared.id}`)).status).toBe(200)
    expect((await who.call('/settings')).status).toBe(403)
    expect((await who.call('/settings/integrations')).status).toBe(403)
    expect((await who.call(`/issues/${visible.identifier}/copy`,'POST',{expectedVersion:(await current(visible.identifier)).version,teamId:outside.id})).status).toBe(404)
    expect((await who.api(`/issues/${hidden.identifier}`)).status).toBe(404)
    expect((await who.api(`/projects/${hiddenProject.id}`)).status).toBe(404)
    expect((await who.api(`/cycles/${hiddenCycle}`)).status).toBe(404)
    expect(JSON.stringify(await json(await who.api("/cycles")))).not.toContain("Guest hidden cycle")
    expect(JSON.stringify(await json(await who.api('/issues')))).not.toContain(hidden.identifier)
    expect(JSON.stringify(await json(await who.api('/metadata')))).not.toContain(outside.name)
  }
  const mixed=await json<{progress:{total:number};teamIds:string[];report:{days:{scope:number|null}[]}}>(await member.call(`/projects/${project.id}`))
  expect(mixed.progress.total).toBe(1)
  expect(mixed.teamIds).toEqual([w.team.id])
  expect(mixed.report.days.every(day=>day.scope===null || day.scope<=1)).toBe(true)
  const copied=await json<{copies:{fromIdentifier:string}[]}>(await guest.call(`/issues/${visible.identifier}/copy`,'POST',{expectedVersion:(await current(visible.identifier)).version,includeSubissues:true}),201)
  expect(copied.copies.map(copy=>copy.fromIdentifier)).toEqual([visible.identifier])
  const viewCount=()=>env.DB.prepare('SELECT count(*) AS n FROM saved_views WHERE owner_operator_id=?').bind(guest.id).first('n')
  const viewsBefore=await viewCount()
  expect((await guest.call('/views','POST',{name:'Guest hidden private view',isShared:false,layout:'list',query:{team:outside.id}})).status).toBe(404)
  expect((await guest.call('/views','POST',{name:'Guest hidden project view',isShared:false,layout:'list',query:{project:hiddenProject.id}})).status).toBe(404)
  expect(await viewCount()).toBe(viewsBefore)
  const options=await json<{operators:{id:string;name:string}[]}>(await invited('/options'))
  expect(options.operators.some(o=>o.id===w.admin.id)).toBe(false)
  expect(options.operators.find(o=>o.id===invitedId)?.name).toBe('Native guest (Guest)')
  expect((await member.call(`/notifications/${hiddenNotification!.id}/read`,'POST',{})).status).toBe(404)
  expect((await member.call(`/notifications/${hiddenNotification!.id}/snooze`,'POST',{until:new Date(Date.now()+86400000).toISOString()})).status).toBe(404)

  // Server-rendered stream resources must use the scoped graph AND scoped
  // relation enrichment; a hidden explicit selection produces no private DTO.
  const nativeRequest=new Request(bindings.APP_ORIGIN+'/app/current/'+visible.identifier,{headers:{cookie:member.cookie,host:new URL(bindings.APP_ORIGIN).host}})
  const operator=await requireOperator(bindings,nativeRequest)
  expect(operator).not.toBeNull()
  const resources=await readPageResources(bindings,nativeRequest,operator!,nativeRequest.url)
  const resourceBody=JSON.stringify(resources)
  expect(resourceBody).toContain(visible.identifier)
  expect(resourceBody).not.toContain(hidden.identifier)
  expect(resourceBody).not.toContain(hiddenChild.identifier)

  // Guest archive management, job status and download are all forbidden.
  const job=await json<{id:string}>(await owner.call('/portability/exports','POST',{}),201)
  for (const [path,method,body] of [['/portability/exports','POST',{}],[`/portability/exports/${job.id}`,'GET',undefined],[`/portability/exports/${job.id}/download`,'GET',undefined],[`/portability/exports/${job.id}/advance`,'POST',{maxParts:1}]] as const)
    expect((await invited(path,method,body)).status,path).toBe(403)
  expect((await owner.call(`/portability/exports/${job.id}/abort`,'POST',{})).ok).toBe(true)

  // The same session and token lose the team on their very next request.
  expect((await owner.call(`/settings/teams/${w.team.id}/members/${member.id}`,'DELETE')).status).toBe(200)
  expect((await member.call(`/issues/${visible.identifier}`)).status).toBe(404)
  expect((await member.api(`/issues/${visible.identifier}`)).status).toBe(404)
  expect(JSON.stringify(await json(await member.call('/notifications')))).not.toContain(visible.identifier)

  // Real concurrent role change between durable mail claim and final recipient
  // admission suppresses a queued message rather than sending its hidden title.
  const recipient=await w.fresh('member')
  const queued=await create('Guest queued private assignment',outside.id)
  let changed=false
  const db=afterNativeStatement(async query=>{
    if (!changed && query.includes('INSERT INTO notification_delivery_attempts')) {
      changed=true
      expect((await owner.call(`/settings/operators/${recipient.id}/role`,'PATCH',{role:'guest',teamIds:[w.team.id]})).status).toBe(200)
    }
  })
  const sent=await request(`/api/issues/${queued.identifier}`,'PATCH',{expectedVersion:queued.version,assigneeOperatorId:recipient.id},owner.cookie,{DB:db})
  expect(sent.status,await sent.clone().text()).toBe(200)
  expect(changed).toBe(true)
  expect(await env.DB.prepare('SELECT status FROM notification_deliveries WHERE identifier=? AND recipient_id=?').bind(queued.identifier,recipient.id).first('status')).toBe('suppressed')
  // Reference projections and retained backlinks obey the reader's current teams.
  const referenceSource=await create('Guest visible reference source',w.team.id), hiddenNow=await current(hidden.identifier)
  expect((await owner.call(`/issues/${referenceSource.identifier}`,'PATCH',{expectedVersion:referenceSource.version,description:`See ${hidden.identifier} and SYNTHETIC_VECTOR-999999.`})).status).toBe(200)
  expect((await owner.call(`/issues/${hidden.identifier}`,'PATCH',{expectedVersion:hiddenNow.version,description:`See ${visible.identifier}.`})).status).toBe(200)
  expect(JSON.stringify(await json(await owner.call(`/issues/${visible.identifier}`)))).toContain('issue.mentioned')
  for(const who of [guest,{call:invited}]) {
    expect(await json(await who.call(`/issues/${referenceSource.identifier}/references`))).toEqual({references:[]})
    const scoped=await json<{activity:{kind:string;nextValue:unknown}[]}>(await who.call(`/issues/${visible.identifier}`))
    expect(scoped.activity.some(row=>row.kind==='issue.mentioned')).toBe(false)
    expect(JSON.stringify(scoped.activity)).not.toContain(hidden.identifier)
    expect((await who.call(`/issues/${hidden.identifier}/references`)).status).toBe(404)
  }

}
