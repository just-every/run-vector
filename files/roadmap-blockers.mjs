import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
import {createAdminRuntime,bootstrapOwner} from '/workspace/run-vector/tests/e2e/admin-runtime-support.mjs';
import {beforePrivateNavigation,settleReads} from '/workspace/run-vector/tests/e2e/collaboration-navigation.mjs';
const mode=process.argv[2],phase=process.argv[3]??'repro';
assert(['body','milestone','journey'].includes(mode));
const packet=process.env.HOME+'/rer-consolidation/work/sd-vector-c-f202-fix2/packet';
const runtime=createAdminRuntime(1440,[],{port:mode==='journey'?15980:mode==='milestone'?15978:15976,inspectorPort:mode==='journey'?15981:mode==='milestone'?15979:15977});
let browser;const receipt={scenario:mode,phase,width:1440};
try{
  runtime.initialize();await runtime.start();
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{Connection:'close'}});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  await bootstrapOwner(page,runtime);
  const base=runtime.base;
  const api=async(path,method='GET',data)=>{
    const response=await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert(response.ok(),method+' '+path+' '+response.status());return response.json();
  };
  const session=await api('/session'),team=(await api('/settings/administration')).teams[0];
  if(mode==='journey'){
    const {roadmapJourney}=await import('/workspace/run-vector/tests/e2e/roadmap-journey.mjs');
    const email='synthetic-roadmap-member@vector.test';
    await api('/settings/operators/invite','POST',{email,displayName:'Roadmap member',role:'member'});
    const {readDevelopmentLink}=await import('/workspace/run-vector/tests/e2e/outbox-session.mjs');
    const link=await readDevelopmentLink(base,context.request,email,runtime.state);
    const memberContext=await browser.newContext({storageState:await context.storageState(),extraHTTPHeaders:{Connection:'close'}});
    try{
      const memberPage=await memberContext.newPage();memberPage.setDefaultTimeout(15000);
      await memberPage.goto(link);await memberPage.getByRole('button',{name:'Confirm',exact:true}).click();await memberPage.waitForURL(base+'/app');
      const member=await (await memberContext.request.get(base+'/api/session')).json();assert.equal(member.role,'member');
      await roadmapJourney({page,memberPage,memberContext,base,api,capture:async()=>{},memberId:member.operatorId,team});
    }finally{await memberContext.close();}
  }else{
    const today=(await api('/roadmap')).today;
    const day=delta=>new Date(Date.parse(today+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
    const create=async(name,dates)=>{
      const data=await api('/settings/projects','POST',{name,leadOperatorId:session.operatorId,...dates});
      const project=data.projects.find(p=>p.name===name);assert(project);
      await api('/issues','POST',{teamId:team.id,projectId:project.id,title:'Synthetic roadmap visibility fixture'});return project;
    };
    const one=await create('One-day project',{startDate:today,targetDate:today});
    const undated=await create('Undated project',{});
    await api('/settings/projects/'+undated.id+'/milestones','POST',{name:'Dated milestone on undated project',targetDate:day(5)});
    await beforePrivateNavigation(page,base+'/app/roadmap');await page.goto(base+'/app/roadmap');
    await page.locator('[data-roadmap-ready="true"]').waitFor();await settleReads(page);
    if(mode==='body'){
      const row=page.locator('[data-roadmap-project="'+one.id+'"]');
      const body=row.getByRole('button',{name:/^Move /});await body.scrollIntoViewIfNeeded();
      const from=await body.boundingBox();assert(from);
      receipt.bodyHit=await body.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.getAttribute('aria-label');});
      const data=await api('/roadmap');
      const dates=[data.today,...data.projects.flatMap(p=>[p.placement.start,p.placement.end,...p.milestones.map(m=>m.targetDate)].filter(Boolean))].map(d=>Date.parse(d+'T00:00:00Z')/86400000);
      const first=Math.min(...dates)-7,span=Math.max(21,Math.max(...dates)+14-first);
      const track=row.locator('.roadmap-track'),box=await track.boundingBox();assert(box);
      const start=from.x+from.width/2,grab=Math.round(first+(start-box.x)/box.width*span);
      const destination=grab+3,x=box.x+(destination-first)/span*box.width;
      const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/roadmap/projects/'+one.id&&r.request().method()==='PATCH');
      await page.mouse.move(start,from.y+from.height/2);await page.mouse.down();
      await page.mouse.move(start+12,from.y+from.height/2+3,{steps:6});
      await page.mouse.move(x,box.y+box.height/2,{steps:12});await page.mouse.move(x+1,box.y+box.height/2);await page.mouse.up();
      const response=await pending;assert.equal(response.status(),200);
      receipt.request=response.request().postDataJSON();
      const after=await api('/projects/'+one.id);
      receipt.before={startDate:today,targetDate:today};receipt.after={startDate:after.startDate,targetDate:after.targetDate};
      assert.notEqual(after.startDate,today,'one-day body drag moves start date');
      assert.equal(after.startDate,after.targetDate,'one-day body drag retains zero duration and moves both dates');
      assert.equal(after.activity.filter(a=>a.kind==='project.dates_changed').length,1,'one gesture creates one date activity');
    }else{
      const projection=(await api('/roadmap')).projects.find(p=>p.id===undated.id);
      receipt.apiMilestones=projection.milestones.map(m=>({name:m.name,targetDate:m.targetDate}));
      const marker=page.getByRole('img',{name:'Milestone Dated milestone on undated project '+day(5),exact:true});
      receipt.desktopMarkers=await marker.count();assert.equal(receipt.desktopMarkers,1,'dated milestone on undated project has a desktop marker');
      await marker.scrollIntoViewIfNeeded();assert(await marker.isVisible());
      await page.screenshot({path:packet+'/roadmap-fixed-1440.png',fullPage:true});
      await page.setViewportSize({width:390,height:844});
      const mobile=page.getByRole('region',{name:'Roadmap list equivalent'});
      assert(await mobile.getByText('◇ Dated milestone on undated project · '+day(5),{exact:true}).isVisible());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      receipt.mobileMilestoneVisible=true;
      await page.screenshot({path:packet+'/roadmap-fixed-390.png',fullPage:true});
    }
  }
  receipt.result='PASS';console.log(JSON.stringify(receipt));
}catch(error){receipt.result='FAIL';receipt.error=error.message;receipt.stack=error.stack;console.error(JSON.stringify(receipt));process.exitCode=1;}
finally{
  if(browser)await browser.close();await runtime.stop();
  await writeFile(packet+'/'+phase+'-'+mode+'.json',JSON.stringify(receipt,null,2)+'\n');
}
