import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {navigate,settleReads} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';

/** Existing collaboration journey: two actual member sessions, no provider. */
export async function exerciseReactions({page,peer,runtime,issue,operator,owner,evidence}) {
  const url=runtime.base+'/app/issues/'+issue.identifier;
  await navigate(page,url);await navigate(peer,url);
  const before=runtime.sql('SELECT id FROM notifications ORDER BY id');
  const version=runtime.sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0].version;
  const screens=roleScreens(evidence);
  const inspect=async(region,name)=>{const size=page.viewportSize();await screens(page,region,name);await page.setViewportSize(size);assert.equal(await page.evaluate(()=>window.__rerHydration?.count??0),0);};
  const description=p=>p.getByRole('region',{name:'Reactions for description',exact:true});
  const comments=p=>p.locator('.comment-entry .issue-reactions').first();
  const badge=(region,emoji,count)=>region.getByRole('button',{name:`${emoji} reaction, ${count}`,exact:true});
  const mutate=async(p,method,action)=>{const response=p.waitForResponse(r=>r.request().method()===method&&new URL(r.url()).pathname.endsWith('/reactions'));await action();assert.equal((await response).status(),200);};
  async function add(p,region,name) {
    await region.getByRole('button',{name:/^Add reaction to/}).click();
    await mutate(p,'PUT',()=>region.getByRole('button',{name,exact:true}).click());
  }
  async function live(p,emoji,count,region,action) {
    const start=performance.now();await action();
    if(count)await badge(region(p),emoji,count).waitFor({timeout:Math.max(1,5000-(performance.now()-start))});
    else await region(p).getByRole('button',{name:new RegExp('^'+emoji+' reaction,')}).waitFor({state:'detached',timeout:Math.max(1,5000-(performance.now()-start))});
    assert.ok(performance.now()-start<5000,'Reaction appears in the second session within the existing five-second window');
  }
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});await peer.setViewportSize({width,height:900});
    const emoji=width===1440?'👍':'🎉',name=width===1440?'Thumbs up':'Celebrate';
    await live(peer,emoji,1,description,()=>add(page,description(page),name));
    await live(page,emoji,2,description,()=>add(peer,description(peer),name));
    const reaction=badge(description(page),emoji,2);await reaction.focus();
    const people=page.getByRole('tooltip').filter({hasText:owner.name});
    assert.equal(await people.isVisible(),true,'Who reacted appears immediately on keyboard focus');
    assert.ok((await people.innerText()).includes(operator.name));
    await inspect(page.locator('.issue-description'),'description-reactions-people-'+width);
    await live(peer,emoji,1,description,()=>mutate(page,'DELETE',()=>reaction.click()));
    await live(page,emoji,0,description,()=>mutate(peer,'DELETE',()=>badge(description(peer),emoji,1).click()));
    await inspect(page.locator('.issue-description'),'description-reactions-removed-'+width);
    // Keep a real reaction for the portable archive at the end of the journey.
    await live(peer,emoji,1,description,()=>add(page,description(page),name));
    const commentEmoji=width===1440?'👀':'🚀',commentName=width===1440?'Eyes':'Rocket';
    await live(peer,commentEmoji,1,comments,()=>add(page,comments(page),commentName));
    await badge(comments(page),commentEmoji,1).focus();
    assert.equal(await page.getByRole('tooltip').filter({hasText:owner.name}).isVisible(),true);
    await inspect(page.locator('.comment-entry').filter({has:page.locator('.issue-reactions')}).first(),'comment-reactions-added-'+width);
    await live(peer,commentEmoji,0,comments,()=>mutate(page,'DELETE',()=>badge(comments(page),commentEmoji,1).click()));
    const bold=page.getByRole('button',{name:'Bold',exact:true}).last();await bold.focus();
    assert.equal(await page.getByRole('tooltip',{name:'Bold',exact:true}).isVisible(),true,'Formatting icon has a keyboard tooltip');
    await inspect(comments(page),'comment-reactions-removed-'+width);
    assert.equal(await peer.evaluate(()=>window.__rerHydration?.count??0),0);
  }
  assert.deepEqual(runtime.sql('SELECT id FROM notifications ORDER BY id'),before,'Reactions create no notifications');
  assert.equal(runtime.sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0].version,version);
  await settleReads(page);await settleReads(peer);
  console.log('ISSUE-017 descriptions/comments, add/remove, who reacted, silent five-second two-session updates passed at 1440 and 390');
}
