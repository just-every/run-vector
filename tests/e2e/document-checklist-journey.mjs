import assert from 'node:assert/strict';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';

/** Document authoring and in-place ticks use the shared Markdown editor. */
export async function documentChecklistJourney(page,context,base,teamId,evidence,record){
 const go=async path=>{await beforePrivateNavigation(page,base+path);await page.goto(base+path);};
 const reload=async()=>{await beforePrivateNavigation(page,page.url());await page.reload();};
 await page.setViewportSize({width:1440,height:1000});
 await go('/app/teams/'+teamId);
 const section=page.getByRole('region',{name:'Documents',exact:true});
 const draft=section.getByRole('form',{name:'Document draft',exact:true});
 await draft.locator('fieldset:enabled').waitFor({state:'attached'});
 if(!await draft.isVisible())await section.locator('summary').filter({hasText:'New document'}).click();
 await draft.getByLabel('Document title',{exact:true}).fill('synthetic-vector-2513');
 const editor=draft.getByRole('textbox',{name:'Document body',exact:true});
 await editor.pressSequentially('[] Review draft\n/checklist');
 await draft.getByRole('option',{name:'Checklist',exact:true}).click();
 await editor.pressSequentially('Publish notes\n');
 await editor.press('Control+Shift+Digit7');
 await editor.pressSequentially('Archive notes');
 assert.equal(await editor.inputValue(),'- [ ] Review draft\n- [ ] Publish notes\n- [ ] Archive notes');
 // Icon controls keep the shared focus tooltip on this document screen.
 await draft.getByRole('button',{name:'Bold text',exact:true}).focus();
 await page.getByRole('tooltip',{name:'Bold text',exact:true}).waitFor();
 await draft.getByRole('button',{name:'Create document',exact:true}).click();
 await page.getByRole('heading',{name:'synthetic-vector-2513',exact:true}).waitFor();
 const id=new URL(page.url()).pathname.split('/').at(-1),path='/api/documents/'+id;
 await reload();
 const content=page.getByRole('region',{name:'Document content',exact:true});
 await content.getByRole('checkbox',{name:'Review draft',exact:true}).waitFor();
 assert.equal(await content.getByRole('checkbox').count(),3);
 const tick=async(name,checked)=>{
  const response=page.waitForResponse(r=>r.url()===base+path+'/checklist'&&r.request().method()==='POST');
  await content.getByRole('checkbox',{name,exact:true}).setChecked(checked);
  assert.equal((await response).status(),200);await settleReads(page);
 };
 await tick('Review draft',true);
 await reload();
 await content.getByRole('checkbox',{name:'Review draft',exact:true}).waitFor();
 assert.equal(await content.getByRole('checkbox',{name:'Review draft',exact:true}).isChecked(),true);
 const current=await (await context.request.get(base+path)).json();
 assert.equal(current.version,2);assert.equal(current.body,'- [x] Review draft\n- [ ] Publish notes\n- [ ] Archive notes');
 const revisions=await (await context.request.get(base+path+'/revisions')).json();
 assert.equal(revisions.revisions.length,2);
 assert.equal(revisions.revisions[1].authorName,current.authorName);
 assert.deepEqual(revisions.revisions[1].checklist,{index:0,text:'Review draft',checked:true});
 await page.locator('summary').filter({hasText:'Revision history'}).click();
 await page.getByText('Checked “Review draft”',{exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Revision 2',exact:true}).locator('..').locator('time').getAttribute('datetime'),revisions.revisions[1].createdAt);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await content.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${evidence}/document-checklist-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await tick('Review draft',false);
 assert.equal((await (await context.request.get(base+path)).json()).body,'- [ ] Review draft\n- [ ] Publish notes\n- [ ] Archive notes');
 record('ISSUE-025','Document editor starts checklists with brackets, the slash menu and the keyboard shortcut; published checkboxes tick and untick without editing, reload preserves GFM, and history names the item and attributed revision. Screens at 1440 and 390.');
}
