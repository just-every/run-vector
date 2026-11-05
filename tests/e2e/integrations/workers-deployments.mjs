import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {roleScreens} from '../role-ui-support.mjs';
import {navigate,trackRequests} from '../collaboration-navigation.mjs';

/** The existing issue read surface identifies an authenticated provider report honestly. */
export async function exerciseWorkersDeployments({page:shared,runtime,cookie,team,evidence}){
 await runtime.freshRequestWindow();
 const page=await shared.context().newPage(),errors=[],inspect=roleScreens(evidence);
 trackRequests(page);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(message.text()))errors.push(message.text());});
 const headers={Cookie:cookie,Origin:runtime.base,'Content-Type':'application/json'};
 const call=async(path,method='GET',body,status=200,extra={})=>{
  const response=await runtime.req('/api'+path,{method,headers:{...headers,...extra},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal(response.status,status,await response.clone().text());return response.json();
 };
 try{
  await page.setViewportSize({width:1440,height:1000});
  const repositoryName='synthetic-vector-18050/source';
  const repository=await call('/settings/integrations/github','POST',{name:'synthetic-vector-18050',repository:repositoryName},201);
  const issue=await call('/issues','POST',{teamId:team.id,title:'synthetic-vector-18051 Workers delivery'},201);
  const merge='a'.repeat(40),deployed='b'.repeat(40);
  const send=async(body,event)=>{
   const text=JSON.stringify(body),signature=createHmac('sha256',repository.secret).update(text).digest('hex');
   const response=await runtime.req(new URL(repository.receiver).pathname,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Event':event,'X-GitHub-Delivery':randomUUID()},body:text});
   assert.equal(response.status,200,await response.clone().text());await response.body.cancel();
  };
  await send({action:'closed',number:18051,repository:{full_name:repositoryName},pull_request:{number:18051,title:'Fixes '+issue.identifier,body:null,merged:true,state:'closed',merge_commit_sha:merge,updated_at:'2026-10-11T11:00:00.000Z',html_url:'https://github.com/'+repositoryName+'/pull/18051'}},'pull_request');
  await send({ref:'refs/heads/main',before:merge,after:deployed,forced:false,repository:{full_name:repositoryName,default_branch:'main'},commits:[]},'push');
  const token=await call('/settings/integrations/tokens','POST',{name:'synthetic-vector-18052',scopes:['deployments:write']},201);
  const report={provider:'cloudflare-workers',repositoryId:repository.id,accountId:'synthetic-vector-18053',workerId:'synthetic-vector-18054',deploymentId:'synthetic-vector-18055',sha:deployed,environment:'staging',state:'success',deployedAt:'2026-10-11T14:15:16+02:00'};
  const submit=body=>call('/v1/deployments','POST',body,200,{Authorization:'Bearer '+token.token});
  const before=await call('/issues/'+issue.identifier);
  assert.equal((await submit(report)).linked,1);
  const staging=await call('/issues/'+issue.identifier);assert.equal(staging.version,before.version);assert.equal(staging.status.id,before.status.id);
  const production={...report,deploymentId:'synthetic-vector-18056',environment:'production'};
  assert.equal((await submit(production)).linked,1);const stable=await call('/issues/'+issue.identifier);
  assert.equal((await submit(production)).reused,true);assert.equal((await call('/issues/'+issue.identifier)).version,stable.version);
  await navigate(page,runtime.base+'/app/issues/'+issue.identifier);
  const section=page.getByRole('region',{name:'GitHub links',exact:true});
  const rows=section.getByRole('listitem').filter({hasText:'Cloudflare Workers'});
  await rows.first().waitFor();assert.equal(await rows.count(),2);
  for(const environment of ['staging','production']){
   const row=rows.filter({hasText:environment});
   assert.equal(await row.count(),1);assert.ok((await row.textContent()).includes('synthetic-vector-18054'));
   assert.equal(await row.locator('time').getAttribute('datetime'),'2026-10-11T12:15:16.000Z');
   assert.ok((await row.textContent()).includes(deployed.slice(0,7)));
   assert.ok(await row.evaluate(element=>parseFloat(getComputedStyle(element).fontSize)>=13));
  }
  await page.reload();await rows.first().waitFor();assert.equal(await rows.count(),2);
  // Assertions use one width; this capture inspects the changed read surface
  // once at desktop and phone widths, including accessibility and overflow.
  await inspect(page,section,'workers-deployments');
  assert.deepEqual(errors,[],'provider readback has no runtime or hydration errors');
  console.log('PROBE RELEASE-002 browser: signed merge and push, authenticated Workers staging and production -> provider-labelled persistent issue readback at 1440 and 390, preserved staging status and inert replay.');
 }finally{await page.close();}
}
