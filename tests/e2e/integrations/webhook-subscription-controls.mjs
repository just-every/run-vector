import assert from 'node:assert/strict';
import { settleReads } from '../collaboration-navigation.mjs';
import { confirmLink, readDevelopmentLink } from '../outbox-session.mjs';
import { openAuthenticatedPage } from '../ui-runtime-auth.mjs';

const issueLabels = ['Issue created', 'Issue updated', 'Issue completed'], commentLabels = ['Comment created', 'Comment edited', 'Comment deleted'];
const webhooks = page => page.getByRole('region', { name: 'Outbound webhooks', exact: true });
const checked = (scope, label) => scope.getByRole('checkbox', { name: label, exact: true }).isChecked();

export async function signedInPerson(runtime, ownerCookie, n, role) {
  const email = ['synthetic-vector-' + n, 'vector.test'].join('@');
  const invited = await runtime.req('/api/settings/operators/invite', { method: 'POST', headers: { Cookie: ownerCookie, Origin: runtime.base, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, displayName: 'synthetic-vector-' + n, role }) });
  assert.equal(invited.status, 202, await invited.clone().text());
  const confirmed = await confirmLink(await readDevelopmentLink(runtime.base, runtime.req, email, runtime.state));
  assert.equal(confirmed.status, 303);
  return confirmed.headers.get('set-cookie').split(';')[0];
}

/** The Owner registers a comment-only destination for one public team. Issue events
 * stay the default, an incomplete choice cannot be sent and private teams are not offered. */
export async function registerFromSettings({ page, runtime, name, url, team, hidden, inspect }) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(runtime.base + '/app/settings');
  const form = webhooks(page).getByRole('group', { name: 'Register a destination', exact: true });
  await form.getByLabel('Destination name', { exact: true }).fill(name);
  await form.getByLabel('Public HTTPS destination', { exact: true }).fill(url);
  const register = form.getByRole('button', { name: 'Register destination', exact: true });
  for (const label of issueLabels) {
    assert.equal(await checked(form, label), true);
    await form.getByRole('checkbox', { name: label, exact: true }).uncheck();
  }
  for (const label of commentLabels) assert.equal(await checked(form, label), false);
  assert.equal(await register.isDisabled(), true);
  for (const label of commentLabels) await form.getByRole('checkbox', { name: label, exact: true }).check();
  assert.equal(await form.getByRole('radio', { name: 'All public teams', exact: true }).isChecked(), true);
  await form.getByRole('radio', { name: 'Only selected teams', exact: true }).check();
  assert.equal(await register.isDisabled(), true);
  const offered = form.getByRole('group', { name: 'Selected teams', exact: true });
  assert.equal(await offered.getByRole('checkbox', { name: hidden.name, exact: true }).count(), 0);
  await offered.getByRole('checkbox', { name: team.name, exact: true }).check();
  assert.equal(await register.isEnabled(), true);
  await inspect(page, form, 'webhook-subscription-register');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const sent = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/integrations/destinations' && r.request().method() === 'POST');
  await register.click();
  const response = await sent;
  assert.equal(response.status(), 201);
  const destination = await response.json();
  await page.getByRole('button', { name: 'I saved it; close', exact: true }).click();
  await page.reload();
  const row = webhooks(page).getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) });
  await row.getByText('Teams: ' + team.name).waitFor();
  const summary = await row.textContent();
  for (const label of commentLabels) assert(summary.includes(label), label);
  for (const label of issueLabels) assert(!summary.includes(label), label);
  await settleReads(page);
  return destination;
}

/** A Member's Settings offers personal tokens only, never destination controls. */
export async function memberSeesNoControls({ browser, runtime, cookie }) {
  const page = await openAuthenticatedPage(browser, cookie, runtime.base), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(runtime.base + '/app/settings');
    await page.locator('#integrations').getByRole('heading', { name: 'API tokens', exact: true }).waitFor();
    assert.equal(await webhooks(page).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^Change events and teams for / }).count(), 0);
    await settleReads(page);
    assert.deepEqual(errors, []);
  } finally { await page.context().close(); }
}

/** An Admin reopens the saved choice, cannot save an incomplete one, and widens the
 * destination to issue creation and new comments from every public team. */
export async function adminChangesFromSettings({ browser, runtime, cookie, name, destination, team, hidden, inspect }) {
  const page = await openAuthenticatedPage(browser, cookie, runtime.base), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(runtime.base + '/app/settings');
    const section = webhooks(page);
    await section.getByRole('button', { name: 'Change events and teams for ' + name, exact: true }).click();
    const editor = section.getByRole('form', { name: 'Events and teams for ' + name, exact: true });
    const offered = editor.getByRole('group', { name: 'Selected teams', exact: true });
    await offered.getByRole('checkbox', { name: team.name, exact: true }).waitFor();
    for (const label of issueLabels) assert.equal(await checked(editor, label), false);
    for (const label of commentLabels) assert.equal(await checked(editor, label), true);
    assert.equal(await editor.getByRole('radio', { name: 'Only selected teams', exact: true }).isChecked(), true);
    assert.equal(await offered.getByRole('checkbox', { name: hidden.name, exact: true }).count(), 0);
    const save = editor.getByRole('button', { name: 'Save events and teams', exact: true });
    await offered.getByRole('checkbox', { name: team.name, exact: true }).uncheck();
    assert.equal(await save.isDisabled(), true);
    await editor.getByRole('radio', { name: 'All public teams', exact: true }).check();
    await editor.getByRole('checkbox', { name: 'Issue created', exact: true }).check();
    for (const label of ['Comment edited', 'Comment deleted']) await editor.getByRole('checkbox', { name: label, exact: true }).uncheck();
    await inspect(page, editor, 'webhook-subscription-edit');
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sent = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/integrations/destinations/' + destination.id + '/subscriptions' && r.request().method() === 'PUT');
    await save.click();
    assert.equal((await sent).status(), 200);
    await section.getByRole('status').filter({ hasText: name }).waitFor();
    assert.equal(await editor.count(), 0);
    // Keyboard focus returns to the row's own control rather than the page.
    assert.equal(await section.getByRole('button', { name: 'Change events and teams for ' + name, exact: true }).evaluate(node => node === document.activeElement), true);
    await settleReads(page);
    assert.deepEqual(errors, []);
  } finally { await page.context().close(); }
}
