import assert from 'node:assert/strict';
import { beforePrivateNavigation,settleReads } from './collaboration-navigation.mjs';

/** REL-007 through the same editor at desktop and phone sizes. */
export async function relatedJourney(page,context,base,teamId,evidence,record) {
  const call=async(path,method='GET',data)=>{
    const response=await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},data});
    assert.ok(response.ok(),method+' '+path+' '+response.status());return response.json();
  };
  const a=await call('/issues','POST',{title:'Investigate weekly billing export delay',teamId});
  const b=await call('/issues','POST',{title:'Document billing export size limits',teamId});
  const open=async(identifier)=>{
    await beforePrivateNavigation(page,base+'/app/issues/'+identifier);
    await page.goto(base+'/app/issues/'+identifier);
    await page.locator('summary').filter({hasText:/^Relationships ·/}).click();
    await settleReads(page);
  };
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await open(a.identifier);
    const editor=page.locator('.dependency-editor');
    await editor.locator('summary').filter({hasText:'Add dependency'}).click();
    await editor.getByLabel('Issue identifier',{exact:true}).fill(b.identifier);
    await editor.getByLabel(/^Direction/).selectOption('related');
    await editor.getByRole('button',{name:'Add dependency',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`${evidence}/REL-007-edit-${width}.png`});
    await editor.getByRole('button',{name:'Add dependency',exact:true}).click();
    await editor.getByRole('button',{name:'Remove related link '+b.identifier,exact:true}).waitFor();
    await page.screenshot({path:`${evidence}/REL-007-related-${width}.png`});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await open(b.identifier);
    await page.getByRole('button',{name:'Remove related link '+a.identifier,exact:true}).waitFor();
    await page.screenshot({path:`${evidence}/REL-007-reverse-${width}.png`});
    await page.getByRole('button',{name:'Remove related link '+a.identifier,exact:true}).click();
    await page.getByRole('button',{name:'Remove related link '+a.identifier,exact:true}).waitFor({state:'detached'});
    await page.screenshot({path:`${evidence}/REL-007-removed-${width}.png`});
    assert.equal((await call('/issues/'+a.identifier)).dependencies.length,0);
  }
  await page.setViewportSize({width:1440,height:1000});
  record('REL-007','At 1440 and 390, relate two issues without blocking, follow the symmetric link and remove it from the other endpoint; both records lose the link.');
}
