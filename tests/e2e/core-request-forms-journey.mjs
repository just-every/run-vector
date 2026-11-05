import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { withOperatorClient } from './operator-request.mjs';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
const require = createRequire(import.meta.url);

/** Mounted authoring, native intake and retained revision, in the same app doors
 * as ordinary intake. The one phone capture keeps the existing desktop flow. */
export async function requestFormsJourney(page, context, base, capture = async () => {}) {
  const api = (path, method = 'GET', data) => withOperatorClient(context, async client => {
    const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  });
  const options = await api('/options'), team = options.teams[0], name = 'synthetic-vector-1892-' + Date.now();
  const navigate = async path => { await beforePrivateNavigation(page, base + path); await page.goto(base + path); await settleReads(page); };
  const hydration = [], listen = message => { if (/hydration|did not match|hydrating/i.test(message.text())) hydration.push(message.text()); };
  page.on('console', listen);
  const audit = async selector => {
    await page.evaluate(source => { const script = document.createElement('script'); script.nonce = document.querySelector('script[nonce]')?.nonce ?? ''; script.textContent = source; document.head.append(script); }, await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'));
    const violations = await page.evaluate(async selector => (await window.axe.run(document.querySelector(selector))).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), selector);
    assert.deepEqual(violations, []);
  };
  const screens = async (label, selector) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no horizontal overflow');
      await capture('TRIAGE-004', 'request-form-' + label + '-' + width, page);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await audit(selector);
  };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate('/app/settings/teams/' + team.id + '/automation');
    const settings = page.getByRole('region', { name: 'Request forms', exact: true });
    await settings.getByRole('button', { name: 'New request form', exact: true }).click();
    const editor = settings.getByRole('form', { name: 'Edit request form', exact: true });
    await editor.getByLabel('Form name', { exact: true }).fill(name);
    assert(await editor.getByLabel('Required field 1', { exact: true }).isChecked());
    await editor.getByRole('button', { name: 'Add form field', exact: true }).click();
    await editor.getByLabel('Field key 2', { exact: true }).fill('steps');
    await editor.getByLabel('Field label 2', { exact: true }).fill('Steps');
    await editor.getByLabel('Help text 2', { exact: true }).fill('Describe the reproduction.');
    await editor.getByLabel('Form name', { exact: true }).focus(); await page.keyboard.press('Tab');
    assert(await editor.getByLabel('Published for new submissions', { exact: true }).evaluate(el => el === document.activeElement));
    await screens('author', '.request-form-settings');
    const published = page.waitForResponse(r => new URL(r.url()).pathname === '/api/teams/' + team.id + '/request-forms' && r.request().method() === 'POST');
    await editor.getByRole('button', { name: 'Save request form', exact: true }).click();
    assert.equal((await published).status(), 201);
    const form = (await api('/teams/' + team.id + '/request-forms')).forms.find(f => f.name === name);
    assert(form); assert.equal(form.revision, 1);
    await navigate('/app/new-issue');
    await page.getByRole('radio', { name: /Intake/ }).check();
    await page.getByRole('combobox', { name: /^Team/ }).selectOption(team.id);
    await page.getByLabel('Request form', { exact: true }).selectOption(form.id);
    await page.getByRole('textbox', { name: /^Title/ }).fill('synthetic-vector-1893');
    const severity = page.getByLabel('Severity (required)', { exact: true });
    assert.equal(await severity.getAttribute('required'), '');
    assert.equal(await severity.evaluate(el => el.validity.valueMissing), true);
    await severity.selectOption('High');
    const steps = '  Reproduce λ and retry  ';
    await page.getByLabel('Steps', { exact: true }).fill(steps);
    await severity.focus(); await page.keyboard.press('Tab');
    assert(await page.getByLabel('Steps', { exact: true }).evaluate(el => el === document.activeElement));
    await screens('submit', '.new-issue-form');
    const submitted = page.waitForResponse(r => new URL(r.url()).pathname === '/api/intake' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create intake', exact: true }).click();
    const submission = await submitted; assert.equal(submission.status(), 201);
    const item = await submission.json();
    assert.equal(item.status.category, 'intake');
    assert.deepEqual(item.requestForm, { id: form.id, revision: 1, name, fields: form.fields, answers: { severity: 'High', steps } });
    await page.waitForURL(base + '/app/issues/' + item.identifier);
    await page.getByRole('region', { name: 'Submitted request form' }).waitFor();
    await page.reload(); await settleReads(page);
    const saved = page.getByRole('region', { name: 'Submitted request form' });
    assert.equal(await saved.locator('dd').nth(0).textContent(), 'High');
    assert.equal(await saved.locator('dd').nth(1).textContent(), steps);
    await screens('saved', '.request-form-saved');
    await api('/teams/' + team.id + '/request-forms/' + form.id, 'PUT', { name: name + '-edited', fields: form.fields, published: true, expectedRevision: 1 });
    await page.reload(); await saved.waitFor();
    assert.equal(await saved.getByRole('heading').textContent(), name);
    assert((await saved.textContent()).includes('Submitted form revision 1'));
    assert.deepEqual((await api('/issues/' + item.identifier)).requestForm.answers, { severity: 'High', steps });
    assert.deepEqual(hydration, []);
    return { identifier: item.identifier, formId: form.id, revision: 1, answers: { severity: 'High', steps }, widths: [1440, 390], hydration };
  } finally { page.off('console', listen); }
}
