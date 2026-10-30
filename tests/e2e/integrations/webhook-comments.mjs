import assert from 'node:assert/strict';
import { join } from 'node:path';
import { settleReads } from '../collaboration-navigation.mjs';
import { roleScreens } from '../role-ui-support.mjs';
import { adminChangesFromSettings, memberSeesNoControls, registerFromSettings, signedInPerson } from './webhook-subscription-controls.mjs';

/** Settings subscription controls decide what the native queue keeps: browser comment
 * mutations reach only the Owner's comment and team choice, a Member has no controls,
 * and an Admin's change governs later mutations without exporting private work. */
export async function exerciseWebhookComments({ page, runtime, cookie, team, evidence }) {
  await runtime.freshRequestWindow();
  const errors = [], onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const call = async (path, method = 'GET', input, status = 200) => {
    const response = await runtime.req('/api' + path, { method, headers: { Cookie: cookie, Origin: runtime.base, 'Content-Type': 'application/json' }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    assert.equal(response.status, status, await response.clone().text());
    return response.json();
  };
  const createIssue = (teamId, title) => call('/issues', 'POST', { teamId, title }, 201);
  const comment = (issue, body) => call('/issues/' + issue.identifier + '/comments', 'POST', { body }, 201);
  const queued = (destination, where = '') => runtime.sql('SELECT event,body FROM vector_webhook_events WHERE destination_id=\'' + destination.id + '\'' + where + ' ORDER BY id');
  const events = ['comment.created', 'comment.updated', 'comment.deleted'], inspect = roleScreens(evidence), name = 'synthetic-vector-9080';
  const other = (await call('/settings/teams', 'POST', { name: 'synthetic-vector-9086', identifierPrefix: 'WHUI' })).teams.find(t => t.name === 'synthetic-vector-9086');
  const hidden = (await call('/settings/teams', 'POST', { name: 'synthetic-vector-9087', identifierPrefix: 'WHPRIV', isPrivate: true })).teams.find(t => t.name === 'synthetic-vector-9087');
  let destination;
  try {
    destination = await registerFromSettings({ page, runtime, name, url: 'https://receiver.example.com/comments', team, hidden, inspect });
    const config = await call('/settings/integrations');
    assert.deepEqual(config.destinations.find(d => d.id === destination.id).events, events);
    assert.deepEqual(config.destinations.find(d => d.id === destination.id).teamIds, [team.id]);
    const issue = await createIssue(team.id, 'synthetic-vector-9081');
    await page.goto(runtime.base + '/app/issues/' + issue.identifier);
    await page.getByRole('heading', { name: 'Discussion', exact: true }).waitFor();
    await settleReads(page);
    const rootText = 'synthetic-vector-9082', replyText = 'synthetic-vector-9083';
    await page.getByRole('textbox', { name: 'Add a comment', exact: true }).fill(rootText);
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    const thread = page.getByRole('region', { name: /^Thread started by/ });
    await thread.getByText(rootText, { exact: true }).waitFor();
    await thread.getByRole('button', { name: 'Reply', exact: true }).click();
    await thread.getByRole('textbox', { name: 'Reply to thread', exact: true }).fill(replyText);
    await thread.getByRole('button', { name: 'Post reply', exact: true }).click();
    await thread.getByText(replyText, { exact: true }).waitFor();
    await page.reload();
    await thread.getByText(rootText, { exact: true }).waitFor();
    await thread.getByText(replyText, { exact: true }).waitFor();
    await settleReads(page);
    const discussion = await call('/issues/' + issue.identifier + '/discussion');
    const root = discussion.comments.find(c => c.body === rootText), reply = discussion.comments.find(c => c.body === replyText);
    assert.equal(reply.parentId, root.id);
    for (const id of [root.id, reply.id]) {
      await call('/issues/' + issue.identifier + '/comments/' + id, 'PATCH', { body: 'synthetic-vector-9084' });
      await call('/issues/' + issue.identifier + '/comments/' + id, 'DELETE');
    }
    // Another public team's comment is outside the chosen team.
    await comment(await createIssue(other.id, 'synthetic-vector-9088'), 'synthetic-vector-9089');
    await page.reload();
    await page.getByRole('heading', { name: 'Discussion', exact: true }).waitFor();
    await settleReads(page);
    assert.equal(await thread.getByText('Comment deleted', { exact: true }).count(), 2);
    assert.equal(await thread.getByText(rootText, { exact: true }).count(), 0);
    assert.equal(await thread.getByText(replyText, { exact: true }).count(), 0);
    const captured = queued(destination);
    assert.equal(captured.length, 6);
    assert.deepEqual(captured.map(e => e.event).sort(), [...events, ...events].sort());
    for (const event of captured) {
      const payload = JSON.parse(event.body);
      assert.equal(payload.issueId, issue.id);
      assert.equal(payload.rootCommentId, root.id);
      assert.equal(payload.parentCommentId, payload.commentId === reply.id ? root.id : null);
      for (const text of [rootText, replyText, 'synthetic-vector-9084']) assert(!event.body.includes(text));
    }
    assert.deepEqual(errors, []);
    // Assertions run at desktop width; phone is the candidate's additional visual proof.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await thread.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(evidence, 'webhook-comment-history-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const browser = page.context().browser();
    await memberSeesNoControls({ browser, runtime, cookie: await signedInPerson(runtime, cookie, 9090, 'member') });
    await adminChangesFromSettings({ browser, runtime, cookie: await signedInPerson(runtime, cookie, 9091, 'admin'), name, destination, team, hidden, inspect });
    const changed = (await call('/settings/integrations')).destinations.find(d => d.id === destination.id);
    assert.deepEqual([changed.events, changed.teamIds], [['issue.created', 'comment.created'], []]);
    // Every public team now sends issue creation and new comments; edits and private work stay out.
    const next = await createIssue(other.id, 'synthetic-vector-9092'), posted = await comment(next, 'synthetic-vector-9093');
    await call('/issues/' + next.identifier + '/comments/' + posted.id, 'PATCH', { body: 'synthetic-vector-9094' });
    const closed = await createIssue(hidden.id, 'synthetic-vector-9095');
    await comment(closed, 'synthetic-vector-9096');
    const later = queued(destination, ' AND json_extract(body,\'$.identifier\') IN (\'' + next.identifier + '\',\'' + closed.identifier + '\')');
    assert.deepEqual(later.map(e => [e.event, JSON.parse(e.body).identifier]).sort(), [['comment.created', next.identifier], ['issue.created', next.identifier]]);
    assert.equal(queued(destination).length, captured.length + 2);
  } finally {
    page.off('pageerror', onError);
    if (destination) await call('/settings/integrations/destinations/' + destination.id, 'DELETE');
  }
}
