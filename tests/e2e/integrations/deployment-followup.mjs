import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {openAdministrationForm} from '../ui-administration-form.mjs';
import {roleScreens} from '../role-ui-support.mjs';
import {navigate,settleReads,trackRequests} from '../collaboration-navigation.mjs';

/** PUSH-003 through Settings, the signed GitHub receiver, the real scheduled
 * handler, the Inbox and the issue page: a merge followed by a production
 * deployment shows production and is never asked about; an undeployed merge
 * past the team's window is asked about exactly once, one inside the window is
 * not, and the assignee answers in the issue's discussion. Screens at 1440 and 390. */
export async function exerciseDeploymentFollowup({page:shared,runtime,cookie,team,evidence}){
 const page=await shared.context().newPage();trackRequests(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());});
 const inspect=roleScreens(evidence),headers={Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'};
 const call=async(path,method='GET',body,status=200)=>{const res=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(res.status,status,await res.clone().text());return res.json();};
 try{
  await page.setViewportSize({width:1440,height:900});
  // The window is set in Settings → Teams → Git automation, as its team's settings managers do.
  await navigate(page,runtime.base+'/app/settings#teams');
  await openAdministrationForm(page,'Edit '+team.name);
  const rules=page.getByRole('region',{name:'Teams',exact:true}).getByRole('region',{name:'Git automation rules',exact:true});
  await rules.getByText(team.name+' Git automation',{exact:true}).click();
  const form=rules.getByRole('group',{name:'Production follow-up',exact:true});
  await form.getByLabel(team.name+' production follow-up window in hours',{exact:true}).fill('1');
  const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/settings/teams/'+team.id);
  await form.getByRole('button',{name:'Save production follow-up',exact:true}).click();assert.equal((await saved).status(),200);
  await form.getByRole('status').getByText('Follow-up saved.',{exact:true}).waitFor();
  await inspect(page,form,'deployment-followup-settings');
  await page.setViewportSize({width:1440,height:900});

  const repository=['synthetic-vector-1930','followup'].join('/');
  const config=await call('/settings/integrations/github','POST',{name:'synthetic-vector-1930',repository},201);
  const send=async(body,event='pull_request')=>{
   const text=JSON.stringify(body),signature=createHmac('sha256',config.secret).update(text).digest('hex');
   const response=await fetch(config.receiver,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Delivery':randomUUID(),'X-GitHub-Event':event},body:text});
   assert.equal(response.status,200,await response.clone().text());await response.body?.cancel();
  };
  const owner=(await call('/session')).operatorId;
  const create=title=>call('/issues','POST',{teamId:team.id,title,assigneeOperatorId:owner},201);
  const deployed=await create('synthetic-vector-1931 deployed checkout'),waiting=await create('synthetic-vector-1932 undeployed checkout'),recent=await create('synthetic-vector-1933 recent checkout');
  const iso=offset=>new Date(Date.now()+offset).toISOString(),sha=n=>n.toString(16).padStart(2,'0').repeat(20);
  const merge=(number,issue,commit,mergedAt)=>({action:'closed',number,repository:{full_name:repository},pull_request:{number,title:'Fixes '+issue.identifier,body:null,state:'closed',merged:true,merge_commit_sha:commit,merged_at:mergedAt,updated_at:mergedAt,html_url:'https://github.com/'+repository+'/pull/'+number}});
  await send(merge(81,deployed,sha(201),iso(-2*3600_000)));
  await send({repository:{full_name:repository},deployment:{id:1931,sha:sha(201),environment:'production'},deployment_status:{state:'success',created_at:iso(-3600_000)}},'deployment_status');
  // Past the one-hour window with no production deployment, and a merge still inside it.
  await send(merge(82,waiting,sha(202),iso(-2*3600_000)));
  await send(merge(83,recent,sha(203),iso(-60_000)));
  for(let run=0;run<2;run++){const tick=await runtime.req('/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *'));assert.equal(tick.status,200);await tick.body?.cancel();}
  const questions=runtime.sql("SELECT i.identifier FROM notifications n JOIN issues i ON i.id=n.issue_id WHERE n.causes_json LIKE '%deployment_question%' AND i.identifier IN ('"+[deployed,waiting,recent].map(i=>i.identifier).join("','")+"')");
  assert.deepEqual(questions.map(q=>q.identifier),[waiting.identifier],'one question, only for the undeployed merge past its window');

  // The question reaches the assignee's Inbox and opens the issue.
  await navigate(page,runtime.base+'/app/inbox');
  const row=page.locator('.inbox-row').filter({hasText:waiting.identifier}).filter({hasText:'Deployment follow-up asks why the merge has not reached production for'});
  await row.waitFor();assert.equal(await row.count(),1);
  await inspect(page,page.locator('.inbox-entry').filter({has:row}),'deployment-followup-inbox');
  await page.setViewportSize({width:1440,height:900});
  await row.click();await page.waitForURL(url=>url.pathname==='/app/issues/'+waiting.identifier);
  const github=page.getByRole('region',{name:'GitHub links',exact:true});
  const question=github.getByRole('note').filter({hasText:'Deployment follow-up asked'});
  await question.waitFor();assert.match(await question.innerText(),/why this merge has not reached production/);
  await inspect(page,github,'deployment-followup-question');
  await page.setViewportSize({width:1440,height:900});
  // The answer goes through the issue's own discussion.
  await question.getByRole('button',{name:'Answer in discussion',exact:true}).click();
  const composer=page.getByRole('textbox',{name:'Add a comment',exact:true});
  assert.ok(await composer.evaluate(element=>element===document.activeElement),'Answer in discussion focuses the comment composer');
  await composer.fill('synthetic-vector-1934 the release train leaves tomorrow');
  const posted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/issues/'+waiting.identifier+'/comments');
  await page.getByRole('button',{name:'Add comment',exact:true}).click();assert.equal((await posted).status(),201);
  await page.getByText('synthetic-vector-1934 the release train leaves tomorrow',{exact:true}).waitFor();
  await navigate(page,runtime.base+'/app/issues/'+waiting.identifier);
  await github.getByRole('note').filter({hasText:'answered in the discussion'}).waitFor();
  const after=await call('/issues/'+waiting.identifier);
  assert.equal(after.assignee?.id,owner,'asking never changes the assignee');
  // The deployed merge shows production and no question.
  await navigate(page,runtime.base+'/app/issues/'+deployed.identifier);
  await github.getByText('reached production',{exact:false}).waitFor();
  assert.equal(await github.getByRole('note').count(),0);
  await inspect(page,github,'deployment-followup-production');
  assert.deepEqual(errors,[],'deployment follow-up screens have no browser or hydration errors');
  console.log('[PUSH-003] Settings window, production record, one Inbox question past the window and none inside it, discussion answer at 1440 and 390');
 }finally{await settleReads(page);await page.close();}
}
