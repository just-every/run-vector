import assert from 'node:assert/strict';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';
import {contrastFailures,canvasLuminance} from './theme-contrast.mjs';

export async function roadmapJourney({page,memberPage,memberContext,base,api,capture,memberId,team}) {
  const runtimeErrors=[];
  const onError=error=>runtimeErrors.push(error.message);
  const onConsole=message=>{if(message.type()==='error'&&/hydrat|Minified React|React error/i.test(message.text()))runtimeErrors.push(message.text());};
  memberPage.on('pageerror',onError);memberPage.on('console',onConsole);
  const day=(date,delta)=>new Date(Date.parse(date+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
  const today=(await api('/roadmap')).today;
  const read=id=>api('/projects/'+id);
  const named=[];
  for(const [suffix,dates] of [
    ['Both dates',{startDate:day(today,-10),targetDate:day(today,20)}],
    ['Target only',{targetDate:day(today,15)}],
    ['Start only',{startDate:day(today,-5)}],['No dates',{}],
    ['One day',{startDate:today,targetDate:today}],['Undated milestone',{}],
  ]){
    const name='synthetic-vector-2040 '+suffix;
    const state=await api('/settings/projects','POST',{name,leadOperatorId:memberId,...dates});
    const project=state.projects.find(p=>p.name===name);assert(project);named.push(project);
    await api('/issues','POST',{teamId:team.id,projectId:project.id,title:'synthetic-vector-2041 '+suffix});
  }
  const [both,target,start,none,oneDay,undatedMilestone]=named;
  await api('/settings/projects/'+undatedMilestone.id+'/milestones','POST',{name:'synthetic-vector-2049',targetDate:day(today,9)});
  await api('/settings/projects/'+both.id,'PATCH',{lifecycle:'active'});
  await api('/settings/projects/'+both.id+'/milestones','POST',{name:'synthetic-vector-2042',targetDate:day(today,7)});
  const labels=await api('/settings/labels','POST',{name:'synthetic-vector-2043',color:'#405080',projectsEnabled:true});
  const label=labels.labels.find(l=>l.name==='synthetic-vector-2043');assert(label);
  const initiative=await api('/initiatives','POST',{name:'synthetic-vector-2044',ownerOperatorId:memberId,targetDate:day(today,40)});
  await api('/initiatives/'+initiative.id+'/projects','PUT',{expectedVersion:initiative.version,projectIds:named.map(p=>p.id)});
  const go=async(targetPage=memberPage)=>{
    await beforePrivateNavigation(targetPage,base+'/app/roadmap');await targetPage.goto(base+'/app/roadmap');
    await targetPage.locator('[data-roadmap-ready="true"]').waitFor();await settleReads(targetPage);
  };
  await memberPage.setViewportSize({width:1440,height:1000});await go();
  const row=id=>memberPage.locator('[data-roadmap-project="'+id+'"]');
  assert.equal(await row(both.id).getAttribute('data-date-kind'),'interval');
  assert.equal(await row(target.id).getAttribute('data-date-kind'),'diamond');
  assert.equal(await row(start.id).getAttribute('data-date-kind'),'open');
  assert.equal(await row(start.id).getAttribute('data-target-date'),'');
  assert.equal(await row(none.id).count(),0);
  await memberPage.locator('[data-unscheduled-project="'+none.id+'"]').waitFor();
  await memberPage.getByRole('img',{name:'Milestone synthetic-vector-2042 '+day(today,7),exact:true}).waitFor();
  const undatedMarker=memberPage.getByRole('img',{name:'Milestone synthetic-vector-2049 '+day(today,9),exact:true});
  await undatedMarker.waitFor();assert(await undatedMarker.isVisible());
  assert.equal(await row(undatedMilestone.id).getAttribute('data-start-date'),'');
  assert.equal(await row(undatedMilestone.id).getAttribute('data-target-date'),'');
  assert.equal(await row(undatedMilestone.id).locator('.roadmap-mark').count(),0,'milestone does not invent project dates');
  assert(await memberPage.locator('[data-unscheduled-project="'+undatedMilestone.id+'"]').isVisible());
  assert.equal(await memberPage.locator('[data-roadmap-initiative="'+initiative.id+'"]').getAttribute('data-date-kind'),'interval');
  assert.equal(await row(both.id).locator('.roadmap-mark--active').count(),1);
  await row(both.id).getByRole('button',{name:'Drag start date for '+both.name,exact:true}).focus();
  await memberPage.getByRole('tooltip',{name:'Drag start date',exact:true}).waitFor();
  await capture('INIT-003','roadmap-four-placements-1440',memberPage);

  async function geometry(){
    const data=await (await memberContext.request.get(base+'/api/roadmap')).json(),dates=[data.today,...data.projects.flatMap(p=>[p.placement.start,p.placement.end,...p.milestones.map(m=>m.targetDate)].filter(Boolean)),...data.initiatives.flatMap(n=>[n.placement.start,n.placement.end].filter(Boolean))].map(d=>Date.parse(d+'T00:00:00Z')/86400000);
    const first=Math.min(...dates)-7,span=Math.max(21,Math.max(...dates)+14-first);return {first,span};
  }
  async function dragTo(source,track,date){
    await source.scrollIntoViewIfNeeded();const from=await source.boundingBox();assert(from);
    const {first,span}=await geometry(),fraction=(Date.parse(date+'T00:00:00Z')/86400000-first)/span;
    await memberPage.mouse.move(from.x+from.width/2,from.y+from.height/2);await memberPage.mouse.down();
    await memberPage.mouse.move(from.x+from.width/2+12,from.y+from.height/2+3,{steps:6});
    await track.evaluate((element,fraction)=>{element.scrollIntoView({block:'nearest'});element.closest('.roadmap-scroll').scrollLeft=element.offsetLeft+element.clientWidth*fraction-300;},fraction);
    const box=await track.boundingBox();assert(box);
    const pending=memberPage.waitForResponse(r=>new URL(r.url()).pathname.startsWith('/api/roadmap/projects/')&&r.request().method()==='PATCH');
    await memberPage.mouse.move(box.x+box.width*fraction,box.y+box.height/2,{steps:12});
    await memberPage.mouse.move(box.x+box.width*fraction+1,box.y+box.height/2);await memberPage.mouse.up();
    assert.equal((await pending).status(),200);await memberPage.locator('[data-roadmap-ready="true"]').waitFor();
  }
  console.log('Roadmap placements and milestone rendered');
  let before=await read(target.id);
  await dragTo(row(target.id).getByRole('button',{name:/^Move /}),row(target.id).locator('.roadmap-track'),day(today,18));
  let after=await read(target.id);assert.equal(after.startDate,null);assert.equal(after.targetDate,day(today,18));assert.equal(after.activity.length,before.activity.length+1);
  assert.equal(after.activity.filter(entry=>entry.kind==='project.dates_changed').length,1);
  console.log('Roadmap target diamond drag accepted');
  before=await read(none.id);
  await dragTo(memberPage.getByRole('button',{name:'Schedule '+none.name,exact:true}),memberPage.getByLabel('Schedule an Unscheduled project',{exact:true}),day(today,2));
  after=await read(none.id);assert.equal(after.startDate,day(today,2));assert(after.targetDate>after.startDate);assert.equal(after.activity.length,before.activity.length+1);
  assert.equal(after.activity.filter(entry=>entry.kind==='project.dates_changed').length,1);
  await row(none.id).waitFor();
  console.log('Roadmap Unscheduled drag accepted');
  for(const project of [target,none]){
    await beforePrivateNavigation(page,base+'/app/projects/'+project.id);await page.goto(base+'/app/projects/'+project.id);
    await page.getByRole('heading',{name:project.name,exact:true,level:1}).waitFor();
    await page.getByText('Dates changed',{exact:true}).waitFor();
    assert.equal(await page.getByText('Dates changed',{exact:true}).count(),1,'one visible activity for the date gesture');
  }
  await beforePrivateNavigation(page,base+'/app/roadmap');await page.goto(base+'/app/roadmap');await settleReads(page);

  // Body movement retains the interval's duration. Each endpoint changes only
  // its own date. All three gestures use the same native checked writer.
  before=await read(both.id);const originalDuration=Date.parse(before.targetDate)-Date.parse(before.startDate);
  const midpoint=day(before.startDate,Math.round(originalDuration/86400000/2));
  await dragTo(row(both.id).getByRole('button',{name:/^Move /}),row(both.id).locator('.roadmap-track'),day(midpoint,2));
  after=await read(both.id);assert.notEqual(after.startDate,before.startDate);assert.equal(Date.parse(after.targetDate)-Date.parse(after.startDate),originalDuration);assert.equal(after.activity.length,before.activity.length+1);
  before=after;
  await dragTo(row(both.id).getByRole('button',{name:'Drag start date for '+both.name,exact:true}),row(both.id).locator('.roadmap-track'),day(before.startDate,1));
  after=await read(both.id);assert.equal(after.startDate,day(before.startDate,1));assert.equal(after.targetDate,before.targetDate);assert.equal(after.activity.length,before.activity.length+1);
  before=after;
  await dragTo(row(both.id).getByRole('button',{name:'Drag target date for '+both.name,exact:true}),row(both.id).locator('.roadmap-track'),day(before.targetDate,1));
  after=await read(both.id);assert.equal(after.startDate,before.startDate);assert.equal(after.targetDate,day(before.targetDate,1));assert.equal(after.activity.length,before.activity.length+1);
  // A one-day interval's center must hit its body even when date handles
  // would overlap it. Use a physical mouse drag, retaining both dates and
  // the zero-day duration, then prove both endpoint controls remain usable.
  before=await read(oneDay.id);
  await dragTo(row(oneDay.id).getByRole('button',{name:/^Move /}),row(oneDay.id).locator('.roadmap-track'),day(today,4));
  after=await read(oneDay.id);assert.notEqual(after.startDate,before.startDate);assert.equal(after.targetDate,after.startDate);assert.equal(after.activity.length,before.activity.length+1);
  before=after;
  await dragTo(row(oneDay.id).getByRole('button',{name:'Drag target date for '+oneDay.name,exact:true}),row(oneDay.id).locator('.roadmap-track'),day(before.targetDate,14));
  after=await read(oneDay.id);assert.equal(after.startDate,before.startDate);assert.equal(after.targetDate,day(before.targetDate,14));assert.equal(after.activity.length,before.activity.length+1);
  before=after;
  await dragTo(row(oneDay.id).getByRole('button',{name:'Drag start date for '+oneDay.name,exact:true}),row(oneDay.id).locator('.roadmap-track'),day(before.startDate,-4));
  after=await read(oneDay.id);assert.equal(after.startDate,day(before.startDate,-4));assert.equal(after.targetDate,before.targetDate);assert.equal(after.activity.length,before.activity.length+1);
  // Restore the main interval as the input for the existing keyboard proof.
  after=await read(both.id);
  console.log('Roadmap body and endpoint drags accepted, including a one-day body');
  await memberPage.getByRole('button',{name:'Week',exact:true}).click();
  before=after;const body=row(both.id).getByRole('button',{name:/^Move /});await body.focus();
  const keyboard=memberPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/roadmap/projects/'+both.id&&r.request().method()==='PATCH');
  await memberPage.keyboard.press('ArrowRight');assert.equal((await keyboard).status(),200);await memberPage.locator('[data-roadmap-ready="true"]').waitFor();
  after=await read(both.id);assert.equal(after.startDate,day(before.startDate,7));assert.equal(after.targetDate,day(before.targetDate,7));assert.equal(after.activity.length,before.activity.length+1);
  await memberPage.getByRole('button',{name:'Quarter',exact:true}).click();assert.equal(await memberPage.getByRole('button',{name:'Quarter',exact:true}).getAttribute('aria-pressed'),'true');
  await memberPage.getByRole('button',{name:'Month',exact:true}).click();
  await row(both.id).getByRole('button',{name:'Edit planning for '+both.name,exact:true}).click();
  const editor=memberPage.getByRole('region',{name:'Planning fields for '+both.name,exact:true});
  async function fieldSave(button){const pending=memberPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/roadmap/projects/'+both.id&&r.request().method()==='PATCH');await editor.getByRole('button',{name:button,exact:true}).click();assert.equal((await pending).status(),200);await memberPage.locator('[data-roadmap-ready="true"]').waitFor();}
  before=after;await editor.getByLabel('Priority',{exact:true}).selectOption('urgent');await fieldSave('Save priority');
  after=await read(both.id);assert.equal(after.priority,'urgent');assert.equal(after.activity.length,before.activity.length+1);
  before=after;await editor.getByRole('checkbox',{name:label.name,exact:true}).check();await fieldSave('Save labels');
  after=await read(both.id);assert.deepEqual(after.labels.map(l=>l.id),[label.id]);assert.equal(after.activity.length,before.activity.length+1);
  before=after;await editor.getByLabel('Start date',{exact:true}).fill(day(after.startDate,1));await fieldSave('Save dates');
  after=await read(both.id);assert.equal(after.startDate,day(before.startDate,1));assert.equal(after.activity.length,before.activity.length+1);
  // Stale editor refuses without a new activity and requires refreshed intent.
  await editor.getByLabel('Target date',{exact:true}).fill(day(after.targetDate,2));
  await api('/settings/projects/'+both.id,'PATCH',{priority:'low'});const raced=await read(both.id);
  const stale=memberPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/roadmap/projects/'+both.id&&r.request().method()==='PATCH');
  await editor.getByRole('button',{name:'Save dates',exact:true}).click();assert.equal((await stale).status(),409);
  await memberPage.getByRole('alert').filter({hasText:'Your edit was not saved'}).waitFor();
  assert.deepEqual((await read(both.id)).activity,raced.activity);assert.equal((await read(both.id)).targetDate,raced.targetDate);
  await go();
  const visible=await (await memberContext.request.get(base+'/api/roadmap')).json();
  const span=visible.initiatives.find(n=>n.id===initiative.id).placement;
  const hiddenTeamState=await api('/settings/teams','POST',{name:'synthetic-vector-2046',identifierPrefix:'SYNROADUI',isPrivate:true});
  const privateTeam=hiddenTeamState.teams.find(t=>t.name==='synthetic-vector-2046');
  const privateProjectState=await api('/settings/projects','POST',{name:'synthetic-vector-2047',leadOperatorId:memberId,startDate:day(today,-100),targetDate:day(today,100)});
  const hidden=privateProjectState.projects.find(p=>p.name==='synthetic-vector-2047');
  await api('/issues','POST',{teamId:privateTeam.id,projectId:hidden.id,title:'synthetic-vector-2048'});
  const node=await api('/initiatives/'+initiative.id);
  await api('/initiatives/'+initiative.id+'/projects','PUT',{expectedVersion:node.version,projectIds:[...named.map(p=>p.id),hidden.id]});
  async function hiddenProjection(){
    const projection=await (await memberContext.request.get(base+'/api/roadmap')).json();
    assert(!JSON.stringify(projection).includes(hidden.id));assert(!JSON.stringify(projection).includes(hidden.name));
    assert.deepEqual(projection.initiatives.find(n=>n.id===initiative.id).placement,span);
    const html=await (await memberContext.request.get(base+'/app/roadmap')).text();
    assert(!html.includes(hidden.id));assert(!html.includes(hidden.name));
  }
  await hiddenProjection();
  await api('/settings/teams/'+privateTeam.id+'/members/'+memberId,'PUT',{role:'member'});
  await go();assert((await (await memberContext.request.get(base+'/api/roadmap')).json()).projects.some(p=>p.id===hidden.id));
  await api('/settings/teams/'+privateTeam.id+'/members/'+memberId,'DELETE');await go();await hiddenProjection();
  console.log('Roadmap keyboard and fields accepted; stale edit refused');
  for(const theme of ['light','dark']){
    await memberContext.request.patch(base+'/api/settings/appearance',{headers:{Origin:base},data:{theme}}).then(response=>assert.equal(response.status(),200));
    await go();assert.equal((await canvasLuminance(memberPage))<.2,theme==='dark');
    assert.deepEqual(await contrastFailures(memberPage),[],theme+' roadmap AA contrast');
    const marks=await memberPage.evaluate(()=>{
      const {parse,behind,ratio}=window.__nonText;
      return [...document.querySelectorAll('.roadmap-mark,.roadmap-span,.roadmap-today,.roadmap-milestone')].map(element=>{
        const style=getComputedStyle(element),isText=element.matches('.roadmap-mark--diamond,.roadmap-span--diamond,.roadmap-milestone');
        const ink=isText?style.color:element.matches('.roadmap-today')?style.backgroundColor:style.borderTopColor;
        return {mark:element.className,contrast:ratio(parse(ink),behind(element.parentElement))};
      }).filter(mark=>mark.contrast<3);
    });
    assert.deepEqual(marks,[],theme+' roadmap marks meet 3:1');
    const accessibility=await memberPage.evaluate(async()=> (await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
    assert.deepEqual(accessibility,[],theme+' roadmap has no serious accessibility violations');
    await capture('INIT-003','roadmap-'+theme+'-1440',memberPage);
  }
  await memberContext.request.patch(base+'/api/settings/appearance',{headers:{Origin:base},data:{theme:'system'}}).then(response=>assert.equal(response.status(),200));
  await memberPage.emulateMedia({colorScheme:'dark'});await go();assert((await canvasLuminance(memberPage))<.2);
  await memberPage.emulateMedia({colorScheme:'light'});assert((await canvasLuminance(memberPage))>.8);
  await memberPage.setViewportSize({width:390,height:844});await go();
  const list=memberPage.getByRole('region',{name:'Roadmap list equivalent',exact:true});assert(await list.isVisible());
  for(const project of named){const item=list.locator('[data-roadmap-list-project="'+project.id+'"]');assert(await item.isVisible());assert.match(await item.textContent(),new RegExp(project.name));}
  assert.equal(await memberPage.getByRole('region',{name:'Project timeline',exact:true}).isVisible(),false);
  assert(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await capture('INIT-003','roadmap-list-390',memberPage);
  // One real browser session is downgraded twice. It keeps visible reads and
  // immediately loses planning controls, even with its retained cookies.
  for(const role of ['guest','viewer']){
    await api('/settings/operators/'+memberId+'/role','PATCH',role==='guest'?{role,teamIds:[team.id]}:{role});
    await go();assert.equal(await memberPage.getByRole('button',{name:/^Edit planning/}).count(),0);
    const projected=await (await memberContext.request.get(base+'/api/roadmap')).json();assert.equal(projected.canEdit,false);
    const current=projected.projects.find(p=>p.id===both.id);assert(current);
    before=await read(both.id);
    const denied=await memberContext.request.patch(base+'/api/roadmap/projects/'+both.id,{headers:{Origin:base},data:{expectedVersion:current.version,priority:'high'}});
    assert.equal(denied.status(),403);after=await read(both.id);assert.equal(after.priority,before.priority);assert.deepEqual(after.activity,before.activity);
    await capture('INIT-003','roadmap-'+role+'-390',memberPage);
    await api('/settings/operators/'+memberId+'/role','PATCH',{role:'member'});
  }
  memberPage.off('pageerror',onError);memberPage.off('console',onConsole);
  assert.deepEqual(runtimeErrors,[],'roadmap hydrates without runtime errors');
  console.log('INIT-003 roadmapJourney PASS: placements, spans, milestones, diamond and Unscheduled drag, body and ends, keyboard, planning fields, stale refusal, roles, phone, themes and AA');
}
