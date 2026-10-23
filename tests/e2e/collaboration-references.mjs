import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** The actor page is shared with the collaboration clauses that follow, which comment on `issue`:
 * the references leave it on another issue at another viewport, so they hand it back on `issue`
 * at the viewport they found. */
export async function exerciseReferences({page,runtime,issue,evidence}) {
 await mkdir(evidence,{recursive:true});const inspect=roleScreens(evidence);const viewport=page.viewportSize();
 const api=async(path,method='GET',data,status=200)=>{const response=await page.request.fetch(runtime.base+'/api'+path,{method,headers:{Origin:runtime.base},...(data===undefined?{}:{data})});assert.equal(response.status(),status);return response.json();};
 const original=await api('/issues/'+issue.identifier);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  const target=await api('/issues','POST',{teamId:original.team.id,title:`Release blocker: confirm restored delivery ${width}`},201);
  const source=await api('/issues','POST',{teamId:original.team.id,title:`Investigate delivery regression ${width}`,description:'Investigation notes.'},201);
  const url=runtime.base+'/app/issues/'+source.identifier;
  await navigate(page,url);
  const edit=async text=>{await page.getByRole('button',{name:'Edit issue',exact:true}).click();await page.locator('.issue-editor-controls [name=description]').fill(text);const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/issues/'+source.identifier);await page.getByRole('button',{name:'Save changes',exact:true}).click();assert.equal((await saved).status(),200);await page.getByRole('button',{name:'Edit issue',exact:true}).waitFor();};
  await edit(`See ${target.identifier}; unknown SYNTHETIC_VECTOR-999999 remains literal.`);
  const descriptionLink=page.locator('.issue-description .safe-markdown').getByRole('link',{name:target.identifier,exact:true});await descriptionLink.waitFor();
  await descriptionLink.focus();assert.equal(await page.getByRole('tooltip').filter({hasText:target.title}).isVisible(),true,'Reference title/status appears immediately on keyboard focus');
  assert.ok((await page.getByRole('tooltip').innerText()).includes(target.status.name));await page.screenshot({path:resolve(evidence,`reference-focus-${width}.png`)});
  await page.getByRole('button',{name:'Edit issue',exact:true}).focus();await descriptionLink.hover();await page.getByRole('tooltip').filter({hasText:target.title}).waitFor();
  await page.screenshot({path:resolve(evidence,`reference-hover-${width}.png`)});
  assert.equal(await page.getByRole('link',{name:'SYNTHETIC_VECTOR-999999',exact:true}).count(),0);
  await page.getByRole('textbox',{name:'Add a comment',exact:true}).fill(`Also see ${target.identifier}.`);
  const comment=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/comments'));
  await page.getByRole('button',{name:'Add comment',exact:true}).click();assert.equal((await comment).status(),201);
  const commentLink=page.locator('.comment-body').getByRole('link',{name:target.identifier,exact:true});await commentLink.waitFor();await commentLink.focus();
  assert.equal(await page.getByRole('tooltip').filter({hasText:target.title}).isVisible(),true);
  await inspect(page,page.locator('.issue-description'),`reference-description-${width}`);await page.setViewportSize({width,height:900});
  await inspect(page,page.locator('.comment-entry').first(),`reference-comment-${width}`);await page.setViewportSize({width,height:900});
  await edit(`Still see ${target.identifier}; investigation progressed.`);
  await navigate(page,runtime.base+'/app/issues/'+target.identifier);await page.getByText('History',{exact:true}).click();
  const backlink=page.getByRole('link',{name:'Mentioned in '+source.identifier,exact:true});await backlink.waitFor();assert.equal(await backlink.count(),1);
  await inspect(page,page.locator('.issue-history'),`reference-backlink-${width}`);await page.setViewportSize({width,height:900});
  await backlink.click();await page.getByRole('heading',{name:source.title,exact:true}).waitFor();
  await edit('The earlier reference was removed.');
  await page.getByRole('button',{name:'Edit comment',exact:true}).click();await page.getByRole('textbox',{name:'Edit comment',exact:true}).fill('The comment reference was removed.');
  const changed=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname.includes('/comments/'));
  await page.getByRole('button',{name:'Save comment',exact:true}).click();assert.equal((await changed).status(),200);
  await navigate(page,runtime.base+'/app/issues/'+target.identifier);await page.getByText('History',{exact:true}).click();
  await page.getByText('· reference removed',{exact:false}).waitFor();assert.equal(await page.getByRole('link',{name:'Mentioned in '+source.identifier,exact:true}).count(),1);
  await inspect(page,page.locator('.issue-history'),`reference-removed-${width}`);await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>window.__rerHydration?.count??0),0);
 }
 await page.setViewportSize(viewport);await navigate(page,runtime.base+'/app/issues/'+issue.identifier);await page.getByRole('heading',{name:original.title,exact:true}).waitFor();
 await settleReads(page);console.log('ISSUE-027 description/comment links, title/status hover and focus, one retained backlink and removed state passed at1440 and390');
}
