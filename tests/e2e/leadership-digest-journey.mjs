import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { roleScreens } from './role-ui-support.mjs';
import { navigate, settleReads } from './collaboration-navigation.mjs';
import { slackAppFixture } from './integrations/channel-provider-edge.mjs';

/** Subscription and channel choices use rendered controls; data setup uses native doors. */
export async function leadershipDigestJourney({page,runtime,call,evidence}) {
  const {base}=runtime,inspect=roleScreens(evidence);
  const settings=await call('/settings/administration');
  const root=await call('/initiatives','POST',{name:'synthetic-vector-4020',ownerOperatorId:settings.viewer.id},201);
  await page.setViewportSize({width:1440,height:1000});
  await navigate(page,base+'/app/initiatives/'+root.id);
  const subscribe=page.getByRole('button',{name:'Subscribe to initiative',exact:true});
  const subscribed=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/subscriptions');
  await subscribe.click();assert.equal((await subscribed).status(),201);
  await page.getByRole('button',{name:'Unsubscribe from initiative',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Unsubscribe from initiative',exact:true}).waitFor();
  assert.ok((await call('/subscriptions')).subscriptions.some(s=>s.subjectType==='initiative'&&s.subjectId===root.id));
  await inspect(page,page.locator('main header'),'leadership-initiative-subscription');
  await page.setViewportSize({width:1440,height:1000});
  await call('/settings/integrations/slack','POST',{botToken:'synthetic-vector-1820'});
  const {slack:{email:memberEmail}}=await call('/settings/notifications');
  const usersPath=process.env.VECTOR_CHANNEL_EDGE+'.users';
  let users={};try{users=JSON.parse(readFileSync(usersPath,'utf8'));}catch{}
  users[memberEmail]={id:'ULEADERSHIP1',team_id:slackAppFixture.teamId,name:'synthetic-vector-4021',real_name:'synthetic-vector-4021',profile:{display_name:'synthetic-vector-4021'}};
  writeFileSync(usersPath,JSON.stringify(users));
  await call('/settings/notifications/slack/link','POST',{slackUserId:'ULEADERSHIP1'});
  await page.getByRole('link',{name:'Choose weekly leadership digest channels in Settings',exact:true}).click();
  const panel=page.getByRole('region',{name:'Weekly leadership digest',exact:true});
  await panel.getByRole('heading',{name:'Weekly leadership digest',exact:true}).waitFor();
  const choose=async(name,value)=>{
    const control=panel.getByRole('checkbox',{name,exact:true});
    const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/settings/notifications/leadership-digest');
    await control.setChecked(value);assert.equal((await saved).status(),200);
    await panel.getByText('Leadership digest channels saved.',{exact:true}).waitFor();
  };
  await choose('Email leadership digest',true);
  await choose('Slack direct message leadership digest',true);
  await page.reload();await panel.getByRole('checkbox',{name:'Email leadership digest',exact:true}).waitFor();
  assert.equal(await panel.getByRole('checkbox',{name:'Email leadership digest',exact:true}).isChecked(),true);
  assert.equal(await panel.getByRole('checkbox',{name:'Slack direct message leadership digest',exact:true}).isChecked(),true);
  assert.deepEqual(await call('/settings/notifications/leadership-digest'),{email:true,slack:true});
  await inspect(page,panel,'leadership-digest-channels');
  await page.setViewportSize({width:1440,height:1000});
  const email=panel.getByRole('checkbox',{name:'Email leadership digest',exact:true});
  await email.focus();
  const off=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/api/settings/notifications/leadership-digest'));
  await page.keyboard.press('Space');assert.equal((await off).status(),200);
  await panel.getByText('Leadership digest channels saved.',{exact:true}).waitFor();
  await choose('Slack direct message leadership digest',false);
  assert.deepEqual(await call('/settings/notifications/leadership-digest'),{email:false,slack:false});
  await navigate(page,base+'/app/initiatives/'+root.id);
  const removed=page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname.startsWith('/api/subscriptions/'));
  await page.getByRole('button',{name:'Unsubscribe from initiative',exact:true}).click();assert.equal((await removed).status(),200);
  await page.getByRole('button',{name:'Subscribe to initiative',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Subscribe to initiative',exact:true}).waitFor();
  assert.ok(!(await call('/subscriptions')).subscriptions.some(s=>s.subjectType==='initiative'&&s.subjectId===root.id));
  await settleReads(page);
  console.log('INIT-004 leadershipDigestJourney: subscription and both channels persist, keyboard withdrawal succeeds; screens 1440 and 390');
}
