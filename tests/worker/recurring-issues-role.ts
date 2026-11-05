import {expect} from 'vitest'
import {snapshot,resetLimits,type roleWorkspace} from './role-fixture'
type Workspace=Awaited<ReturnType<typeof roleWorkspace>>
export async function recurringRoleJourney(w:Workspace) {
  const owner=w.people.owner
  const made=await owner.call('/issue-templates','POST',{name:'synthetic-vector-1721',teamId:w.team.id,defaults:{title:'synthetic-vector-1722'}})
  expect(made.status).toBe(201);const template=await made.json() as {id:string}
  const input={name:'synthetic-vector-1723',teamId:w.team.id,templateId:template.id,templateVersion:1,cadence:'weekly',startsOn:'2099-01-05'}
  const activeResponse=await owner.call('/recurring-issues','POST',input);expect(activeResponse.status).toBe(201)
  const active=await activeResponse.json() as {id:string}
  const watched=['recurring_issue_series','recurring_issue_occurrences','recurring_issue_activations','issues','issue_activity','issue_followers','notifications','audit_records']
  for(const person of [owner,w.admin,w.lead,w.member]) {
    const created=await person.call('/recurring-issues','POST',input);expect(created.status,await created.clone().text()).toBe(201)
    const series=await created.json() as {id:string}
    const pause=await person.call('/recurring-issues/'+series.id,'PATCH',{expectedVersion:1,state:'paused'});expect(pause.status).toBe(200);expect(await pause.json()).toMatchObject({state:'paused',version:2})
    const end=await person.call('/recurring-issues/'+series.id,'PATCH',{expectedVersion:2,state:'ended'});expect(end.status).toBe(200);expect(await end.json()).toMatchObject({state:'ended',version:3})
  }
  const outsider=await w.fresh('member',false),viewer=await w.fresh('member')
  expect((await owner.call('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer'})).status).toBe(200)
  for(const person of [outsider,w.guest,viewer])for(const [path,method,body] of [
    ['/recurring-issues','POST',input],
    ['/recurring-issues/'+active.id,'PATCH',{expectedVersion:1,state:'paused'}],
    ['/recurring-issues/'+active.id,'PATCH',{expectedVersion:1,state:'ended'}],
  ] as const) {
    await resetLimits()
    const before=await snapshot(watched),response=await person.call(path,method,body)
    expect(response.status,await response.clone().text()).toBe(403)
    expect(await snapshot(watched)).toEqual(before)
  }
  expect((await outsider.call('/recurring-issues/'+active.id)).status).toBe(403)
  const listing=await outsider.call('/recurring-issues');expect(listing.status).toBe(200);expect(JSON.stringify(await listing.json())).not.toContain(active.id)
  expect((await owner.call('/recurring-issues/'+active.id,'PATCH',{expectedVersion:1,state:'ended'})).status).toBe(200)
}
