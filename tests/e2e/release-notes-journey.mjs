import assert from 'node:assert/strict';
import {navigate,settleReads} from './collaboration-navigation.mjs';

const focused=page=>page.evaluate(()=>{const element=document.activeElement;return {tag:element?.tagName??'',text:element?.tagName==='TEXTAREA'?'':element?.textContent?.trim()??'',label:element?.labels?.[0]?.textContent?.trim()??''};});
const focusOn=(page,text)=>page.waitForFunction(text=>document.activeElement?.textContent?.trim()===text,text);

/** RELEASE-003 on the release screen at one width: draft internal notes from a
 * new native release's six completed issues, edit one line by keyboard, save,
 * and reload the exact edited draft. Returns the release and its edited line. */
export async function releaseNotesJourney({page,base,call,team,done,owner,width,inspect}){
 const tag=suffix=>'synthetic-vector-'+suffix+'-'+width;
 const projects=[];
 for(const name of [tag(9241),tag(9242)]){
  const state=await call('/settings/projects','POST',{name,leadOperatorId:owner});
  projects.push(state.projects.find(project=>project.name===name));
 }
 const issues=[];
 for(let index=0;index<6;index++)issues.push(await call('/issues','POST',{
  teamId:team.id,statusId:done.id,projectId:projects[index<3?0:1].id,title:tag(9243)+'-'+index,
 },201));
 const open=await call('/issues','POST',{teamId:team.id,projectId:projects[0].id,title:tag(9244)},201);
 const currentTitle=tag(9245)+' current title';
 await call('/issues/'+issues[0].identifier,'PATCH',{expectedVersion:issues[0].version,title:currentTitle});
 let release=await call('/releases','POST',{name:tag(9246),description:tag(9247)+' independent description'},201);
 assert.equal(release.ownerOperatorId,owner);
 release=await call('/releases/'+release.id+'/scope','PUT',{
  expectedVersion:release.version,projectIds:projects.map(project=>project.id),issueIdentifiers:issues.map(issue=>issue.identifier),
 });
 const door='/releases/'+release.id+'/notes',screen=base+'/app/releases/'+release.id;
 const line=(index,title)=>'- ['+issues[index].identifier+'](/app/issues/'+issues[index].identifier+') — '+title;
 const expected='## ['+projects[0].name+'](/app/projects/'+projects[0].id+')\n\n'+[
  line(0,currentTitle),line(1,tag(9243)+'-1'),line(2,tag(9243)+'-2'),
 ].join('\n')+'\n\n## ['+projects[1].name+'](/app/projects/'+projects[1].id+')\n\n'+[
  line(3,tag(9243)+'-3'),line(4,tag(9243)+'-4'),line(5,tag(9243)+'-5'),
 ].join('\n')+'\n';

 await navigate(page,screen);await page.getByRole('heading',{name:release.name,exact:true}).waitFor();
 const notes=page.getByRole('region',{name:'Release notes',exact:true});
 const draftButton=notes.getByRole('button',{name:'Draft release notes',exact:true});
 await draftButton.waitFor();await draftButton.focus();
 const drafted=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api'+door);
 await page.keyboard.press('Enter');assert.equal((await drafted).status(),201);
 await notes.getByRole('status').filter({hasText:'Drafted revision 1.'}).waitFor();
 for(const issue of issues)await notes.getByRole('link',{name:issue.identifier,exact:true}).waitFor();
 for(const project of projects)await notes.getByRole('heading',{name:project.name,exact:true}).waitFor();
 const rendered=await notes.locator('.safe-markdown').innerText();
 assert.ok(rendered.includes(currentTitle)&&!rendered.includes(tag(9243)+'-0')&&!rendered.includes(tag(9244)),'current titles of completed issues only');
 const generated=await call(door);
 assert.equal(generated.draft.body,expected);assert.equal(generated.draft.ownerOperatorId,owner);assert.equal(generated.draft.version,1);
 assert.deepEqual(generated.draft.sources.map(source=>source.id),issues.map(issue=>issue.id));
 await focusOn(page,'Edit release notes');assert.equal((await focused(page)).tag,'SUMMARY','drafting returns focus to the notes editor');
 await inspect(notes,'release-notes-drafted');

 // Keyboard: open the editor, replace one line's title, then save.
 await notes.getByText('Edit release notes',{exact:true}).focus();
 await page.keyboard.press('Enter');
 const field=notes.getByLabel('Release notes Markdown',{exact:true});
 await field.waitFor();await page.keyboard.press('Tab');
 assert.deepEqual(await focused(page),{tag:'TEXTAREA',text:'',label:'Release notes Markdown'});
 const original=tag(9243)+'-1',replacement=tag(9248)+' edited line',edited=expected.replace(original,replacement);
 await field.evaluate((element,text)=>{const at=element.value.indexOf(text);element.setSelectionRange(at,at+text.length);},original);
 await page.keyboard.type(replacement);
 assert.equal(await field.inputValue(),edited);
 await field.focus();await page.keyboard.press('Tab');
 assert.deepEqual(await focused(page),{tag:'BUTTON',text:'Save release notes',label:''});
 const saving=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api'+door);
 await page.keyboard.press('Enter');assert.equal((await saving).status(),200);
 await notes.getByRole('status').filter({hasText:'Saved revision 2.'}).waitFor();
 const ownerName=(await call('/settings')).operators.find(person=>person.id===owner).name;
 await notes.getByText('Owner: '+ownerName+' · Revision 2 by '+ownerName+' · ',{exact:false}).waitFor();
 await focusOn(page,'Edit release notes');

 // Stale writes and regeneration are refused; scope change keeps the edited text.
 const saved=(await call(door)).draft;
 assert.equal(saved.body,edited);assert.equal(saved.version,2);
 await call(door,'POST',{expectedReleaseVersion:release.version},409);
 await call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:1,body:tag(9249)+' stale'},409);
 release=await call('/releases/'+release.id+'/scope','PUT',{expectedVersion:release.version,projectIds:[],issueIdentifiers:issues.map(issue=>issue.identifier)});

 // Reload the screen: the exact edited draft returns, marked as predating the change.
 await settleReads(page);await navigate(page,screen);await page.getByRole('heading',{name:release.name,exact:true}).waitFor();
 // The textarea also holds the text, so read the rendered line itself.
 await notes.getByRole('listitem').filter({hasText:replacement}).waitFor();
 await notes.getByRole('note').waitFor();
 await notes.getByText('Edit release notes',{exact:true}).click();
 assert.equal(await field.inputValue(),edited);
 const reloaded=await call(door);
 assert.equal(reloaded.releaseChanged,true);assert.deepEqual(reloaded.draft,saved);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'release notes have no horizontal overflow');
 await inspect(notes,'release-notes-reloaded');
 assert.equal(release.description,tag(9247)+' independent description');assert.equal(release.status,'planned');
 for(const issue of issues){
  const detail=await call('/issues/'+issue.identifier);
  assert.equal(detail.activity.filter(event=>event.kind==='release.published'&&event.nextValue.releaseId===release.id).length,0);
 }
 await settleReads(page);
 console.log('PROBE RELEASE-003 '+width+': six exact completed sources by project with current titles; one line edited by keyboard, saved and reloaded exactly; stale writes refused; scope change keeps edited text; no publication');
 return {release,replacement};
}
