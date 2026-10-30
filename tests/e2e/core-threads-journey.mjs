import { commentChecklistJourney } from './comment-checklist-journey.mjs';
import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
import { withInvitedOperator } from './core-operator-journey.mjs';

const teammate = 'Thread teammate';

/** ISSUE-008: a teammate replies twice and resolves; the author reopens with a reply. */
export async function threadsJourney(page, context, base, state, teamId, evidence, record) {
  const description = 'Review the **report summary** before shipping. Use `synthetic-vector-1`.\n\n```txt\nsynthetic-vector-2\n```\n\nThis text stays.';
  const created = await context.request.post(base + '/api/issues', { headers: { Origin: base }, data: { title: `Thread journey ${Date.now()}`, teamId, description } });
  assert.equal(created.status(), 201);
  const { identifier } = await created.json();
  const url = base + '/app/issues/' + identifier;
  const open = async () => {
    await beforePrivateNavigation(page, url);
    await page.goto(url);
    await page.getByRole('heading', { name: 'Discussion', exact: true }).waitFor();
    await settleReads(page);
  };
  const thread = () => page.getByRole('region', { name: /^Thread started by/ });
  await open();
  await page.getByRole('textbox', { name: 'Add a comment', exact: true }).fill('Which browsers fail to load the report?');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await thread().getByText('Which browsers fail to load the report?').waitFor();
  const root = (await (await context.request.get(base + `/api/issues/${identifier}/discussion`)).json()).comments[0];

  await withInvitedOperator(page, context, base, state, async () => {
    await open();
    // Another member's comment offers neither editing nor deletion, and the route refuses an edit.
    assert.equal(await thread().getByRole('button', { name: 'Edit comment', exact: true }).count(), 0);
    assert.equal(await thread().getByRole('button', { name: 'Delete comment', exact: true }).count(), 1, 'Workspace Owners delete any comment');
    const refused = await context.request.patch(base + `/api/issues/${identifier}/comments/${root.id}`, { headers: { Origin: base }, data: { body: 'Rewritten by a teammate' } });
    assert.equal(refused.status(), 403);
    for (const reply of ['Safari 18 on macOS', 'Firefox 131 too']) {
      await thread().getByRole('button', { name: 'Reply', exact: true }).click();
      await thread().getByRole('textbox', { name: 'Reply to thread', exact: true }).fill(reply);
      await thread().getByRole('button', { name: 'Post reply', exact: true }).click();
      await thread().getByRole('list', { name: 'Replies' }).getByText(reply).waitFor();
    }
    assert.deepEqual(await thread().getByRole('list', { name: 'Replies' }).locator('.comment-body').allInnerTexts(), ['Safari 18 on macOS', 'Firefox 131 too']);
    await thread().getByRole('button', { name: 'Resolve thread', exact: true }).click();
    const summary = page.getByRole('region', { name: /^Resolved thread/ });
    await summary.getByText(`Resolved by ${teammate}`).waitFor();
    assert.equal(await summary.locator('.comment-entry').count(), 0, 'A resolved thread collapses to one line');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await summary.scrollIntoViewIfNeeded();
      assert.ok((await summary.boundingBox()).width <= width);
      await page.screenshot({ path: `${evidence}/thread-resolved-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await settleReads(page);
  }, teammate);

  await open();
  const summary = page.getByRole('region', { name: /^Resolved thread/ });
  await summary.getByText(`Resolved by ${teammate}`).waitFor();
  await summary.getByRole('button', { name: 'Show thread', exact: true }).click();
  await thread().getByRole('button', { name: 'Reply', exact: true }).click();
  await thread().getByRole('textbox', { name: 'Reply to thread', exact: true }).fill('Fixed in build 42, please retest');
  await thread().getByRole('button', { name: 'Post reply', exact: true }).click();
  await thread().getByRole('button', { name: 'Resolve thread', exact: true }).waitFor();
  assert.equal(await page.getByRole('region', { name: /^Resolved thread/ }).count(), 0, 'A new reply reopens the thread');
  assert.equal(await thread().getByRole('list', { name: 'Replies' }).locator('.comment-entry').count(), 3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await thread().scrollIntoViewIfNeeded();
    assert.ok((await thread().boundingBox()).width <= width);
    await page.screenshot({ path: `${evidence}/thread-reopened-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const activity = (await (await context.request.get(base + `/api/issues/${identifier}`)).json()).activity.map((entry) => entry.kind);
  assert.deepEqual(activity.filter((kind) => kind.startsWith('thread.')), ['thread.resolved', 'thread.reopened']);
  await settleReads(page);
  await commentChecklistJourney(page, context, base, state, teamId, evidence, record);
  await open();
  record('ISSUE-008', 'At 1440px and 390px a teammate replies twice in order under a top-level comment, cannot edit it (no control; PATCH 403), resolves the thread and sees it collapse to one line naming them; the author expands it, replies, and the thread reopens with resolve/reopen activity recorded.');

  // Use the browser selection in the rendered description, including Markdown
  // formatting. The resulting thread belongs in the adjacent margin.
  for (const literal of ['synthetic-vector-1','synthetic-vector-2']) {
    await page.locator('.issue-description code[data-description-start]').filter({hasText:literal}).evaluate(element => {
      const range=document.createRange();range.selectNodeContents(element);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
    });
    await page.getByRole('button',{name:'Comment on selection',exact:true}).click();
    assert.equal(await page.locator('.description-thread-margin form blockquote').innerText(),literal);
    await page.getByRole('complementary',{name:'Description threads',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
  }
  await page.locator('.issue-description [data-description-start]').filter({hasText:'report summary'}).evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selected = window.getSelection();
    selected.removeAllRanges(); selected.addRange(range);
  });
  await page.getByRole('button', {name:'Comment on selection',exact:true}).click();
  await page.getByRole('textbox', {name:'Comment on quoted text',exact:true}).fill('Can we confirm these totals?');
  await page.getByRole('button', {name:'Start thread',exact:true}).click();
  await page.locator('.description-thread-margin form.comment-composer').waitFor({state:'detached'});
  const margin = () => page.getByRole('complementary',{name:'Description threads',exact:true});
  await margin().getByText('Can we confirm these totals?',{exact:true}).waitFor();
  const persisted = (await (await context.request.get(base + `/api/issues/${identifier}/discussion`)).json()).comments.find(c=>c.anchor);
  assert.deepEqual(persisted.anchor,{quote:'report summary',start:description.indexOf('report summary'),end:description.indexOf('report summary')+'report summary'.length,removed:false});
  await open();
  await margin().getByRole('blockquote',{name:'Quoted description text'}).getByText('report summary',{exact:true}).waitFor();
  await margin().getByText('Can we confirm these totals?',{exact:true}).waitFor();
  await margin().getByRole('button',{name:'Show quoted text',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.getSelection().toString()),'report summary');
  const reaction = margin().getByRole('button',{name:'Add 👍 reaction',exact:true});
  await reaction.focus();
  await page.getByRole('tooltip',{name:'Add 👍 reaction',exact:true}).waitFor();
  await reaction.blur();
  const sourceBox = await page.locator('.description-source').boundingBox(), marginBox = await margin().boundingBox();
  assert.ok(marginBox.x >= sourceBox.x + sourceBox.width, 'The quote is shown in the description margin on desktop');
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await margin().scrollIntoViewIfNeeded();
    await page.screenshot({path:`${evidence}/description-thread-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  const detail = await (await context.request.get(base + `/api/issues/${identifier}`)).json();
  const removed = await context.request.patch(base + `/api/issues/${identifier}`, {headers:{Origin:base},data:{expectedVersion:detail.version,description:'This text stays.'}});
  assert.equal(removed.status(),200);
  await open();
  await margin().getByText('Quoted text removed',{exact:true}).waitFor();
  assert.equal(await margin().locator('del').innerText(),'report summary');
  await margin().getByText('Can we confirm these totals?',{exact:true}).waitFor();
  await margin().getByRole('button',{name:'Reply',exact:true}).click();
  await margin().getByRole('textbox',{name:'Reply to thread',exact:true}).fill('The original totals remain under discussion.');
  await margin().getByRole('button',{name:'Post reply',exact:true}).click();
  await margin().getByText('The original totals remain under discussion.',{exact:true}).waitFor();
  await open();
  await margin().getByText('Quoted text removed',{exact:true}).waitFor();
  await margin().getByText('The original totals remain under discussion.',{exact:true}).waitFor();
  assert.equal((await (await context.request.get(base + `/api/issues/${identifier}/discussion`)).json()).comments.find(c=>c.id===persisted.id).anchor.removed,true);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await margin().scrollIntoViewIfNeeded();
    await page.screenshot({path:`${evidence}/description-thread-removed-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  await settleReads(page);
  record('ISSUE-008','Highlighting formatted issue-description text starts a quoted thread in the margin. Its quote and source positions survive reload; removing the source retains the thread, marks the quote removed and keeps replies after reload. Desktop and phone screens recorded.');

  const { operators } = await (await context.request.get(base + '/api/mentions/options')).json();
  const operator = operators[0];
  const linked = await (await context.request.post(base + '/api/issues', {headers:{Origin:base},data:{teamId,title:'Release review checklist'}})).json();
  const name = encodeURIComponent(operator.name).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const selectedSource = `Ask @{${operator.id}|${name}} to review ${linked.identifier}`;
  const current = await (await context.request.get(base + `/api/issues/${identifier}`)).json();
  await context.request.patch(base + `/api/issues/${identifier}`, {headers:{Origin:base},data:{expectedVersion:current.version,description:selectedSource}});
  await open();
  await page.locator('.issue-description .mention-chip').waitFor();
  await page.locator(`.issue-description a[href="/app/issues/${linked.identifier}"]`).waitFor();
  await page.locator('.issue-description p').evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selected = window.getSelection();
    selected.removeAllRanges(); selected.addRange(range);
  });
  await page.getByRole('button',{name:'Comment on selection',exact:true}).click();
  await page.getByRole('textbox',{name:'Comment on quoted text',exact:true}).fill('Please confirm the release review.');
  await page.getByRole('button',{name:'Start thread',exact:true}).click();
  await page.locator('.description-thread-margin form.comment-composer').waitFor({state:'detached'});
  await margin().getByText('Please confirm the release review.',{exact:true}).waitFor();
  const selectedThread = (await (await context.request.get(base + `/api/issues/${identifier}/discussion`)).json()).comments.find(c=>c.body==='Please confirm the release review.');
  assert.deepEqual(selectedThread.anchor,{quote:selectedSource,start:0,end:Array.from(selectedSource).length,removed:false});
}
