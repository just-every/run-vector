import assert from 'node:assert/strict';
import { navigate } from './collaboration-navigation.mjs';
import { invitePerson } from './settings-pane-support.mjs';
import { roleScreens } from './role-ui-support.mjs';

/** Exercise the lifecycle through native HTTP and render retained attribution.
 * The assignment dialog and suspended-directory interface remain unqualified. */
export async function memberSuspensionJourney({page,browser,runtime,clause,evidence}) {
  const {base,sql}=runtime,headers={Origin:base},inspect=roleScreens(evidence);
  const email='synthetic-vector-9350'+String.fromCharCode(64)+'vector.test',name='synthetic-vector-9350';
  const call=async(actor,path,method='GET',data,status=200)=>{
    const response=await actor.request.fetch(base+'/api'+path,{method,headers,...(data===undefined?{}:{data})});
    assert.equal(response.status(),status,await response.text());
    return response.json();
  };
  let context;
  await clause('ROLE-011','native suspension retains rendered names and hidden personal state; reactivation requires fresh sign-in',async()=>{
    await page.setViewportSize({width:1440,height:1000});
    await navigate(page,base+'/app/settings/people');
    assert.equal((await invitePerson(page,{name,email,role:'member'})).status(),202);
    const link=()=>sql(`SELECT json_extract(message,'$.text') text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email}' ORDER BY created_at DESC,sequence DESC LIMIT 1`)[0].text.match(/https?:\/\/[^\s]+/)[0];
    context=await browser.newContext({viewport:{width:1440,height:1000}});
    const member=await context.newPage(),errors=[];
    member.on('pageerror',error=>errors.push(error.message));
    try {
      await member.goto(link());await member.getByRole('button',{name:'Confirm',exact:true}).press('Enter');await member.waitForURL(base+'/app');
      const id=(await call(member,'/session')).operatorId;
      const team=(await call(page,'/settings/teams','POST',{name:'synthetic-vector-9351',identifierPrefix:'SUSP'})).teams.find(row=>row.identifierPrefix==='SUSP');
      await call(page,`/settings/teams/${team.id}/members/${id}`,'PUT',{role:'member'});
      const issue=await call(member,'/issues','POST',{title:'synthetic-vector-9352',teamId:team.id,assigneeOperatorId:id},201);
      await call(member,`/issues/${issue.identifier}/comments`,'POST',{body:'synthetic-vector-9353'},201);
      await call(member,`/issues/${issue.identifier}/comments`,'POST',{body:'synthetic-vector-9354'},201);
      const view=await call(member,'/views','POST',{name:'synthetic-vector-9355',isShared:false,layout:'list',query:{team:team.id}},201);
      await member.goto('about:blank');
      await call(page,`/settings/operators/${id}/suspend`,'POST',{assignments:'keep'});
      await call(member,'/session','GET',undefined,401);
      const directory=await call(page,'/settings/operators/suspended');
      assert.equal(directory.members.find(row=>row.id===id).assignedIssueCount,1);
      const profile=await call(page,`/settings/operators/${id}/suspension`);
      assert.equal(profile.assignedIssues[0].flag,'Assignee suspended');
      await navigate(page,base+'/app/issues/'+issue.identifier);
      await page.getByText('synthetic-vector-9353',{exact:true}).waitFor();
      assert.ok(await page.getByText(name+' (Suspended)',{exact:true}).count()>=2);
      await inspect(page,page.locator('main'),'suspended-history');
      await call(page,`/settings/operators/${id}/reactivate`,'POST',{});
      await call(member,'/session','GET',undefined,401);
      const sent=await member.request.post(base+'/auth/request',{headers,data:{email}});assert.equal(sent.status(),202);
      await member.goto(link());await member.getByRole('button',{name:'Confirm',exact:true}).press('Enter');await member.waitForURL(base+'/app');
      assert.equal((await call(member,'/session')).operatorId,id);
      assert.equal((await call(member,'/views/'+view.id)).name,'synthetic-vector-9355');
      const discussion=await call(member,`/issues/${issue.identifier}/discussion`);
      assert.deepEqual(discussion.comments.map(row=>row.actor),[name,name]);
      await navigate(page,base+'/app/issues/'+issue.identifier);
      await page.getByText('synthetic-vector-9353',{exact:true}).waitFor();
      assert.equal(await page.getByText(name+' (Suspended)',{exact:true}).count(),0);
      await inspect(page,page.locator('main'),'reactivated-history');
      assert.deepEqual(errors,[],'no member hydration errors');
    } finally {await context.close();}
  });
}
