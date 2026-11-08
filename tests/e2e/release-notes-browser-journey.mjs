import assert from 'node:assert/strict';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';
import {openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {withOperatorClient} from './operator-request.mjs';

export async function releaseNotesBrowserJourney({page,base,call,evidence,fixture}){
 const {issues,projects,expected,edited}=fixture;
 let release=await call('/releases','POST',{name:'synthetic-vector-9250',description:'synthetic-vector-9251 separate release description'},201);
 release=await call('/releases/'+release.id+'/scope','PUT',{expectedVersion:release.version,projectIds:projects.map(project=>project.id),issueIdentifiers:issues.map(issue=>issue.identifier)});
 const door='/releases/'+release.id+'/notes',url=base+'/app/releases/'+release.id;
 const region=page.getByRole('region',{name:'Internal release notes',exact:true});
 const editor=region.getByLabel('Release notes Markdown',{exact:true});
 const response=(method,status)=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api'+door&&r.request().method()===method&&r.status()===status);
 await page.setViewportSize({width:1440,height:1000});
 await navigate(page,url);
 const generate=region.getByRole('button',{name:'Generate draft',exact:true});
 await generate.waitFor();
 assert.equal(await editor.count(),0,'no invented draft before generation');
 await generate.focus();assert.ok(await generate.evaluate(node=>node===document.activeElement));
 let pending=response('POST',201);await page.keyboard.press('Enter');
 const generated=(await(await pending).json()).draft;
 assert.deepEqual(generated.sources.map(source=>source.id).sort(),issues.map(issue=>issue.id).sort());
 assert.equal(generated.body,expected,'current titles and stable project grouping');
 await editor.waitFor();assert.equal(await editor.inputValue(),expected);
 assert.equal(await generate.count(),0,'generation cannot overwrite human edits');
 await editor.fill(edited);
 const preview=region.getByRole('region',{name:'Draft preview',exact:true});
 await preview.getByText(/synthetic-vector-9248 edited line/).waitFor();
 const save=region.getByRole('button',{name:'Save draft',exact:true});
 await save.focus();pending=response('PATCH',200);await page.keyboard.press('Enter');
 const saved=(await(await pending).json()).draft;
 assert.equal(saved.body,edited);assert.equal(saved.version,2);
 await settleReads(page);await page.reload();
 await editor.waitFor();assert.equal(await editor.inputValue(),edited,'reload retains the exact human draft');
 assert.equal((await call('/releases/'+release.id)).description,'synthetic-vector-9251 separate release description');
 assert.equal((await call('/releases/'+release.id)).status,'planned');
 assert.equal(await page.getByRole('button',{name:'Mark Released',exact:true}).count(),1);
 assert.ok(await region.evaluate(root=>[...root.querySelectorAll('p,span,label,button,textarea,summary,h2,h3,a')].every(node=>parseFloat(getComputedStyle(node).fontSize)>=13)),'notes text is at least 13px');
 const inspect=roleScreens(evidence);
 await inspect(page,region,'release-notes-edited');
 await page.setViewportSize({width:1440,height:1000});

 // A real second native edit causes a stale save. The typed conflict is kept
 // until its author explicitly chooses to replace it with the saved revision.
 const local=edited+'synthetic-vector-9252 unsaved local line\n';
 await editor.fill(local);
 const external=edited+'synthetic-vector-9253 other saved revision\n';
 const remote=await call(door,'PATCH',{expectedReleaseVersion:release.version,expectedVersion:2,body:external});
 pending=response('PATCH',409);await save.click();await pending;
 await region.getByRole('alert').waitFor();
 assert.equal(await editor.inputValue(),local,'a refused stale save preserves local text');
 assert.equal((await call(door)).draft.body,external,'stale refusal changes no saved text');
 const reload=region.getByRole('button',{name:'Reload saved draft and discard my text',exact:true});
 await reload.click();
 await page.waitForFunction(value=>document.querySelector('textarea[aria-label="Release notes Markdown"]')?.value===value||[...document.querySelectorAll('textarea')].some(node=>node.value===value),external);
 assert.equal(await editor.inputValue(),external);

 // A scope edit in this page must not remount the notes editor or discard its
 // local text. Saving uses the new release version while keeping its sources.
 const retained=external+'synthetic-vector-9254 retained through scope change\n';
 await editor.fill(retained);
 await page.getByText('Choose release scope',{exact:true}).click();
 const scopeResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/releases/'+release.id+'/scope'&&r.request().method()==='PUT');
 await page.getByRole('button',{name:'Save release scope',exact:true}).click();assert.equal((await scopeResponse).status(),200);
 assert.equal(await editor.inputValue(),retained);
 pending=response('PATCH',200);await save.click();await pending;
 const afterScope=await call(door);
 assert.equal(afterScope.draft.body,retained);assert.deepEqual(afterScope.draft.sources,generated.sources);
 assert.equal(afterScope.draft.version,remote.draft.version+1);
 await settleReads(page);await navigate(page,url+'?readOnly=1');
 await region.getByRole('region',{name:'Draft preview',exact:true}).getByText(/synthetic-vector-9254 retained through scope change/).waitFor();
 assert.equal(await editor.count(),0);assert.equal(await region.getByRole('button',{name:'Save draft',exact:true}).count(),0);
 assert.equal(await region.getByRole('button',{name:'Generate draft',exact:true}).count(),0);
 for(const issue of issues){
  const detail=await call('/issues/'+issue.identifier);
  assert.equal(detail.activity.filter(event=>event.kind==='release.published'&&event.nextValue.releaseId===release.id).length,0);
 }
 console.log('PROBE RELEASE-003 browser: keyboard generation from six completed issues -> grouped Markdown; exact human edit survives save and reload; stale save preserves local text; explicit reload and scope edits retain accountable draft; read-only view has no draft mutations; release description and publication remain separate');
}

export async function releaseNotesAccessJourney({page:shared,base,call,member}){
 const memberId=member.session.operatorId;
 await call('/settings/operators/'+memberId+'/role','PATCH',{role:'member',teamIds:[]});
 const privateName='synthetic-vector-9255';
 const team=(await call('/settings/teams','POST',{name:privateName,identifierPrefix:'NTEPRV',isPrivate:true})).teams.find(team=>team.name===privateName);
 await call('/settings/teams/'+team.id+'/members/'+memberId,'PUT',{role:'member'});
 const issue=await call('/issues','POST',{teamId:team.id,statusId:team.statuses.find(status=>status.category==='completed').id,title:'synthetic-vector-9256 private completed title'},201);
 const page=await openAuthenticatedPage(shared.context().browser(),member.cookie,base);
 page.setDefaultTimeout(15000);await page.setViewportSize({width:1440,height:1000});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(message.text()))errors.push(message.text());});
 const memberCall=(path,method='GET',data,status=200)=>withOperatorClient(page.context(),async client=>{
  const result=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},data});
  assert.equal(result.status(),status,await result.text());return result.json();
 });
 try{
  let release=await memberCall('/releases','POST',{name:'synthetic-vector-9257 member-owned notes'},201);
  assert.equal(release.ownerOperatorId,memberId);
  release=await memberCall('/releases/'+release.id+'/scope','PUT',{expectedVersion:release.version,projectIds:[],issueIdentifiers:[issue.identifier]});
  const door='/api/releases/'+release.id+'/notes';
  await navigate(page,base+'/app/releases/'+release.id);
  const region=page.getByRole('region',{name:'Internal release notes',exact:true}),editor=region.getByLabel('Release notes Markdown',{exact:true});
  let pending=page.waitForResponse(response=>new URL(response.url()).pathname===door&&response.request().method()==='POST');
  await region.getByRole('button',{name:'Generate draft',exact:true}).click();assert.equal((await pending).status(),201);
  await editor.waitFor();assert.ok((await editor.inputValue()).includes(issue.title));
  const before=await call('/releases/'+release.id+'/notes');
  await editor.fill(before.draft.body+'synthetic-vector-9258 private unsaved text');
  await call('/settings/teams/'+team.id+'/members/'+memberId,'DELETE');
  pending=page.waitForResponse(response=>new URL(response.url()).pathname===door&&response.request().method()==='PATCH');
  await region.getByRole('button',{name:'Save draft',exact:true}).click();assert.equal((await pending).status(),404);
  await region.getByRole('alert').waitFor();assert.equal(await editor.count(),0,'withdrawal clears private local text');
  await page.waitForFunction(title=>!document.body.innerText.includes(title),issue.title);
  const visible=await page.locator('body').innerText();
  assert.ok(!visible.includes(issue.title));assert.ok(!visible.includes('synthetic-vector-9258'));
  assert.deepEqual((await call('/releases/'+release.id+'/notes')).draft,before.draft,'withdrawn save leaves saved draft unchanged');
  await settleReads(page);await page.reload();
  await region.getByRole('alert').waitFor();assert.ok(!(await page.locator('body').innerText()).includes(issue.title));
  assert.deepEqual(errors,[],'Member notes screen has no browser errors');
  console.log('PROBE RELEASE-003 private access: recorded Member owner generates notes; source membership withdrawn -> save refused 404, private saved and unsaved text disappear, storage unchanged and reload remains unavailable');
 }finally{await settleReads(page);await page.context().close();}
}
