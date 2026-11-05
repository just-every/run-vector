import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { withOperatorClient } from './operator-request.mjs'
import { beforePrivateNavigation } from './collaboration-navigation.mjs'

/** AUTO-001 Settings controls through the administration runtime's one phone width, with the genuine scheduled
 * export at the current time. The worker journey owns later weeks, DST, skip-while-open and authority depth. */
export async function recurringIssuesJourney({page,runtime,capture}) {
  const base=runtime.base,context=page.context(),errors=[]
  const onError=e=>errors.push(e.message)
  page.on('pageerror',onError)
  const api=async(path,method='GET',data)=>withOperatorClient(context,async client=>{
    const response=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})})
    assert(response.ok(),method+' '+path+' '+response.status());return response.json()
  })
  const tick=async()=>{
    const response=await context.request.get(base+'/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *'))
    assert.equal(response.status(),200);await response.body()
  }
  const issues=()=>runtime.sql('SELECT count(*) n FROM issues')[0].n
  const go=async path=>{await beforePrivateNavigation(page,base+path);await page.goto(base+path)}
  try {
    const options=await api('/options'),team=options.teams[0],owner=options.operators.find(o=>o.id===options.operator.id)
    const {timezone}=(await api('/settings/administration')).workspace
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(new Date())
    const due=new Date(Date.parse(today+'T12:00:00Z')+2*86400000).toISOString().slice(0,10)
    const templateInput={name:'synthetic-vector-1740',teamId:team.id,defaults:{title:'synthetic-vector-1741',description:'## Weekly check'},subissues:[{title:'synthetic-vector-1742'},{title:'synthetic-vector-1743'}]}
    const template=await api('/issue-templates','POST',templateInput)
    const project=(await api('/settings/projects','POST',{name:'synthetic-vector-1744',leadOperatorId:owner.id})).projects.find(p=>p.name==='synthetic-vector-1744')
    await go('/app/settings/teams/'+team.id+'/planning')
    const region=page.getByRole('region',{name:'Recurring issues',exact:true})
    await expect(region).toHaveAttribute('aria-busy','false')
    const row=name=>region.locator('li.recurring-row').filter({has:page.locator('.row-name',{hasText:new RegExp('^'+name+'$')})})
    const create=async({name,skip,assignee,project:chosen,offset})=>{
      const open=region.getByRole('button',{name:'New recurring issue',exact:true})
      await open.focus();await page.keyboard.press('Enter')
      const form=page.getByRole('form',{name:'New recurring issue',exact:true}),title=form.getByLabel('Recurring issue name',{exact:true})
      await expect(title).toBeFocused();await page.keyboard.type(name)
      await form.getByLabel('Recurring issue template',{exact:true}).selectOption(template.id)
      await form.getByLabel('First occurrence',{exact:true}).fill(today)
      if(offset!==undefined)await form.getByLabel('Due offset in days',{exact:true}).fill(String(offset))
      if(assignee)await form.getByLabel('Recurring issue assignee',{exact:true}).selectOption(assignee)
      if(chosen)await form.getByLabel('Recurring issue project',{exact:true}).selectOption(chosen)
      if(skip)await form.getByLabel('Skip a week while the previous issue is open',{exact:true}).check()
      const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/recurring-issues'&&r.request().method()==='POST')
      await title.focus();await page.keyboard.press('Enter')
      const response=await saved;assert.equal(response.status(),201);const series=await response.json()
      await region.getByRole('status').filter({hasText:name+' created.'}).waitFor()
      return series
    }
    const weekly=await create({name:'synthetic-vector-1745',skip:true,assignee:owner.id,project:project.id,offset:2})
    assert.deepEqual({person:weekly.configuringPersonId,team:weekly.teamId,template:weekly.templateId,version:weekly.templateVersion,timezone:weekly.timezone,state:weekly.state,startsOn:weekly.startsOn,nextOn:weekly.nextOn,skip:weekly.skipWhileOpen,offset:weekly.dueOffsetDays,overrides:weekly.overrides},
      {person:owner.id,team:team.id,template:template.id,version:1,timezone,state:'enabled',startsOn:today,nextOn:today,skip:true,offset:2,overrides:{assigneeOperatorId:owner.id,projectId:project.id}})
    // The genuine scheduled export creates one complete graph; repeating the tick republishes nothing.
    const before=issues();await tick();await tick()
    assert.equal(issues(),before+3,'one parent and two subissues across repeated ticks')
    const [occurrence]=(await api('/recurring-issues/'+weekly.id)).history
    assert.equal(occurrence.outcome,'created');assert.equal(occurrence.dueOn,today)
    const parent=await api('/issues/'+occurrence.issue.identifier)
    assert.deepEqual({title:parent.title,assignee:parent.assignee?.id,project:parent.project?.id,dueDate:parent.dueDate},{title:'synthetic-vector-1741',assignee:owner.id,project:project.id,dueDate:due})
    const children=(await api('/issues/'+parent.identifier+'/subissues')).children
    assert.deepEqual(children.map(c=>c.title),['synthetic-vector-1742','synthetic-vector-1743'])
    assert.deepEqual(occurrence.children.map(c=>c.id).sort(),children.map(c=>c.id).sort())
    const provenance=runtime.sql(`SELECT next_value_json v FROM issue_activity WHERE issue_id='${parent.id}' AND kind='issue.template_applied'`)
    assert.deepEqual(provenance.map(r=>JSON.parse(r.v)),[{templateId:template.id,templateVersion:1}])

    // A template edited after configuration fails visibly, with nothing created.
    const stale=await create({name:'synthetic-vector-1746'})
    await api('/issue-templates/'+template.id,'PUT',{...templateInput,expectedVersion:1})
    const beforeFailure=issues();await tick();assert.equal(issues(),beforeFailure,'a failed occurrence creates no partial graph')
    await page.reload();await expect(region).toHaveAttribute('aria-busy','false')
    await row(stale.name).locator('.recurring-failure').filter({hasText:'The template changed'}).first().waitFor()
    const history=row(weekly.name).locator('summary',{hasText:'Configuration and history for '+weekly.name})
    await history.focus();await page.keyboard.press('Enter')
    const configuration=row(weekly.name).locator('.recurring-configuration')
    for(const text of ['synthetic-vector-1740 · version 1',owner.name,timezone,'2 days after each week starts','synthetic-vector-1744','Skips a week while the previous issue is open'])
      await configuration.getByText(text,{exact:false}).first().waitFor()
    const entries=row(weekly.name).getByRole('list',{name:'Occurrence history',exact:true}).getByRole('listitem')
    await expect(entries).toHaveCount(1)
    for(const issue of [parent,...children])await expect(entries.first().getByRole('link',{name:new RegExp('^'+issue.identifier+'(?: |$)')})).toHaveAttribute('href','/app/issues/'+issue.identifier)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Settings recurring rows fit the viewport')
    await capture('recurring-issue-history')

    // Stops: pause by keyboard, then end; neither later tick changes stored work.
    const pause=row(weekly.name).getByRole('button',{name:'Pause '+weekly.name,exact:true})
    await pause.focus();await page.keyboard.press('Enter')
    const confirmPause=row(weekly.name).getByRole('group',{name:'Pause '+weekly.name,exact:true}).getByRole('button',{name:'Pause series',exact:true})
    await confirmPause.focus();await page.keyboard.press('Space')
    await region.getByRole('status').filter({hasText:weekly.name+' paused.'}).waitFor()
    await row(stale.name).getByRole('button',{name:'End '+stale.name,exact:true}).click()
    await row(stale.name).getByRole('group',{name:'End '+stale.name,exact:true}).getByRole('button',{name:'End series',exact:true}).click()
    await region.getByRole('status').filter({hasText:stale.name+' ended.'}).waitFor()
    await expect(row(weekly.name).locator('.row-meta').first()).toHaveText('Paused · Weekly · No future weeks')
    await expect(row(stale.name).getByRole('button',{name:/^(?:Pause|End) /})).toHaveCount(0)
    const stopped=issues();await tick();assert.equal(issues(),stopped)
    const states=(await api('/recurring-issues')).series.filter(s=>[weekly.id,stale.id].includes(s.id)).map(s=>[s.id,s.state,s.history.map(h=>h.outcome)])
    assert.deepEqual(states.sort(),[[weekly.id,'paused',['created']],[stale.id,'ended',['failed']]].sort())
    await capture('recurring-issue-stopped')
    assert.deepEqual(errors,[],'no browser exceptions or hydration errors')
    console.log('PROBE AUTO-001 browser: Settings creates a weekly series from a native template; repeated scheduled exports -> one parent and two linked children with provenance; stale template -> visible failure and no partial graph; keyboard pause and end -> later export creates nothing')
  } finally { page.off('pageerror',onError) }
}
