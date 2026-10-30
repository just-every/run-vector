import { undoParentJourney } from './core-undo-parent.mjs';
import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';
import {undoPropertiesJourney} from './core-undo-properties.mjs';

export async function undoJourney(page,context,base,record,independent=journey=>journey()){
 const originalViewport=page.viewportSize();
 for(const width of [1440,390]){
  await independent(async()=>{
  await page.setViewportSize({width,height:width===390?844:1000});
  await bulkUndoJourney(page,context,base,record);
  await undoPropertiesJourney(page,context,base,record);
  });
 }
 await page.setViewportSize({width:1440,height:1000});
 await independent(()=>undoParentJourney(page,context,base,record));
 await page.setViewportSize(originalViewport);
}

async function bulkUndoJourney(page,context,base,record){
 const api=async(path,method='GET',data)=>{
  return withOperatorClient(context, async client => {
    const response=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert(response.ok(),`${method} ${path}: ${response.status()}`);return await response.json();
  });
 };
 const options=await api('/options'),team=options.teams[0],marker='Undo checkout planning '+Date.now();
 const issues=[];for(const [index,priority]of['low','medium'].entries())issues.push(await api('/issues','POST',{teamId:team.id,title:marker+' '+index,priority}));
 await beforePrivateNavigation(page,base+'/app/issues');await page.goto(base+'/app/issues?'+new URLSearchParams({q:marker,grouping:'none'}));
 await page.waitForFunction(()=>document.querySelectorAll('.issues-row:not(:disabled)').length===2);
 for(const issue of issues){await page.locator('#issue-row-'+issue.identifier).focus();await page.keyboard.press('x')}
 async function changePriority(value){
  await page.locator('#issue-row-'+issues[0].identifier).focus();await page.keyboard.press('p');
  const dialog=page.getByRole('dialog',{name:'Change priority',exact:true});
  await dialog.getByRole('combobox',{name:'Priority',exact:true}).pressSequentially(value);
  const [response]=await Promise.all([page.waitForResponse(response=>response.url()===base+'/api/issues/bulk'&&response.request().method()==='POST'),dialog.getByRole('button',{name:'Apply changes',exact:true}).press('Enter')]);
  assert.equal(response.status(),200);assert(response.headers()['x-vector-undo']);await dialog.waitFor({state:'detached'});
  await page.getByRole('region',{name:'Issue Undo',exact:true}).getByRole('button',{name:'Undo',exact:true}).waitFor();
 }
 await changePriority('High');
 // Native text undo must remain owned by an editable control.
 const search=page.getByLabel('Title or identifier',{exact:true});await search.focus();
 const undoRequests=[];const watch=request=>{if(request.url()===base+'/api/issues/undo'&&request.method()==='POST')undoRequests.push(request)};
 page.on('request',watch);await page.keyboard.press('Control+z');assert.equal(undoRequests.length,0);page.off('request',watch);
 await page.locator('#issue-row-'+issues[0].identifier).focus();
 let [reversal]=await Promise.all([page.waitForResponse(response=>response.url()===base+'/api/issues/undo'),page.keyboard.press('Meta+z')]);
 assert.equal(reversal.status(),200);
 for(const original of issues){const current=await api('/issues/'+original.identifier);assert.equal(current.priority,original.priority);assert.equal(current.version,original.version+2);assert.equal(current.activity.filter(row=>row.nextValue?.undoOf).length,1)}
 await settleReads(page);await changePriority('Urgent');
 [reversal]=await Promise.all([page.waitForResponse(response=>response.url()===base+'/api/issues/undo'),page.getByRole('region',{name:'Issue Undo',exact:true}).getByRole('button',{name:'Undo',exact:true}).click()]);
 assert.equal(reversal.status(),200);for(const original of issues)assert.equal((await api('/issues/'+original.identifier)).priority,original.priority);
  await settleReads(page);await changePriority('High');
  await page.getByRole('button',{name:'Dismiss Undo notice',exact:true}).click();
  await page.locator('#issue-row-'+issues[0].identifier).focus();
  [reversal]=await Promise.all([page.waitForResponse(response=>response.url()===base+'/api/issues/undo'),page.keyboard.press('Meta+z')]);
  assert.equal(reversal.status(),200);for(const original of issues)assert.equal((await api('/issues/'+original.identifier)).priority,original.priority);
 record('ISSUE-020','A selected bulk edit offers one Undo; Cmd-Z and the visible control restore both previous priorities with one reversal activity each, while Ctrl-Z in a text control makes no Undo request.');
}
