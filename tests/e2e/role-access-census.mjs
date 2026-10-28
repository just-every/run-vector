import assert from 'node:assert/strict';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

const raw=(page,base,path)=>page.evaluate(async url=>{
 const response=await fetch(url);return {status:response.status,text:await response.text(),cache:response.headers.get('cache-control')};
},base+'/api'+path);
async function download(page,link){
 const [result]=await Promise.all([page.waitForEvent('download'),link.click()]);
 assert.equal(await result.failure(),null);const stream=await result.createReadStream(),chunks=[];
 for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks).toString('utf8');
}

/** A populated notification, CSV row and real R2 object cross the same current
 * visibility boundary. An empty result alone can never satisfy the safe case. */
export async function viewerAccessCensus({owner,page,reader,runtime,evidence}){
 const {base}=runtime,api=reader.api,screens=roleScreens(evidence);
 const inspect=async(actor,region,name)=>{const viewport=actor.viewportSize();await screens(actor,region,name);await actor.setViewportSize(viewport);};
 const name='synthetic-vector-32010';
 const team=(await owner('/settings/teams','POST',{name,identifierPrefix:'SYNVCEN'})).teams.find(team=>team.name===name);
 const issue=await owner('/issues','POST',{title:'synthetic-vector-32011',teamId:team.id,statusId:team.statuses.find(status=>status.category==='started').id,assigneeOperatorId:reader.id},201);
 const bytes='synthetic-vector-32012';
 const upload=await page.evaluate(async({url,bytes})=>{
  const response=await fetch(url,{method:'POST',headers:{'content-type':'text/plain','x-file-name':'synthetic-vector-32012.txt'},body:bytes});
  return {status:response.status,body:await response.json()};
 },{url:base+'/api/issues/'+issue.identifier+'/files',bytes});
 assert.equal(upload.status,201);const filePath='/issues/'+issue.identifier+'/files/'+upload.body.id;
 const query='?q='+encodeURIComponent(issue.title),actor=reader.page;
 const check=async(visible)=>{
  const notifications=await api('/notifications'),count=await api('/notifications/count');
  assert.equal(notifications.items.some(item=>item.identifier===issue.identifier),visible,'addressed notification follows current access');
  assert.equal(count.unreadCount,notifications.unreadCount);
  const report=await api('/insights'+query);assert.equal(report.total,visible?1:0);
  const csv=await raw(actor,base,'/insights.csv'+query+(visible?'&bucket='+encodeURIComponent(report.rows[0].key):''));assert.equal(csv.status,200);assert.equal(csv.text.includes(issue.identifier),visible);
  const attachment=await raw(actor,base,filePath);assert.equal(attachment.status,visible?200:404);
  if(visible){assert.equal(attachment.text,bytes);assert.ok(attachment.cache.includes('no-store'));}
  else assert.ok(!attachment.text.includes(bytes));
  await navigate(actor,base+'/app/inbox');await settleReads(actor);
  assert.equal((await actor.locator('main:visible').first().innerText()).includes(issue.title),visible,'Inbox renders current addressed content');
 };
 for(const width of [1440,390]){
  await actor.setViewportSize({width,height:width===390?844:1000});
  await check(true);
  await inspect(actor,actor.locator('main:visible').first(),'viewer-access-inbox-'+width);
  await navigate(actor,base+'/app/insights');await settleReads(actor);
  await actor.locator('summary').filter({hasText:'Filter issues'}).click();
  const filtered=actor.waitForResponse(response=>new URL(response.url()).pathname==='/api/insights'&&new URL(response.url()).searchParams.get('q')===issue.title);
  await actor.getByLabel('Title or identifier',{exact:true}).fill(issue.title);assert.equal((await filtered).status(),200);await settleReads(actor);
  await actor.getByRole('button',{name:/^View 1 issues for/}).first().click();
  await actor.getByRole('heading',{name:'Counted issues (1)',exact:true}).waitFor();
  assert.ok((await download(actor,actor.getByRole('link',{name:'Export counted issues CSV',exact:true}))).includes(issue.identifier));
  await inspect(actor,actor.locator('main:visible').first(),'viewer-access-export-'+width);
  await navigate(actor,base+'/app/issues/'+issue.identifier);await actor.getByRole('heading',{name:issue.title,exact:true}).waitFor();
  const files=actor.locator('main:visible details.issue-files');
  await files.locator('summary').click();
  assert.equal(await download(actor,files.getByRole('link',{name:'synthetic-vector-32012.txt',exact:true})),bytes);
  await inspect(actor,actor.locator('main:visible').first(),'viewer-access-attachment-'+width);
  await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:true});await check(false);
  await inspect(actor,actor.locator('main:visible').first(),'viewer-private-inbox-'+width);
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'PUT',{role:'member'});await check(true);
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'DELETE');await check(false);
  await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:false});await check(true);
 }
}
