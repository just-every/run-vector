import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createProtocol } from '../../vendor/base/agent-door/conformance/protocol.mjs';
import { accessToken, autonomousPolicy, heldPolicy } from '../../vendor/base/agent-door/conformance/crypto.mjs';

/** A person uses the actual built pages, native decisions and native records.
 * Browser routing supplies only the disposable installation's hosted origin. */
export async function browserJourney({ request, origin, surface, signer, person, db }) {
  const stored = await db.prepare("SELECT json_extract(envelope,'$.seq') seq,json_extract(envelope,'$.revision') revision FROM agent_door_state WHERE id=1").first();
  const c = createProtocol({ fetch: request, origin, surface, signer, person, business: 'rer-agent-conformance',
    consent: randomUUID(), agentId: randomUUID(), seq: stored?.seq ?? 0, revision: stored?.revision ?? 0, listed: new Map(), points: [] });
  const session = await c.personJson('/api/session'); c.sponsor.id = session.operatorId;
  const options = await c.personJson('/api/metadata');
  const token = () => accessToken(c, { act: { sub: c.agentId, name: 'Riley Delivery', specialist: surface.specialist } });
  const tool = async (name, args) => c.tool(name, { ...args, idempotency_key: randomUUID() }, { token: await token() });
  const done = async (name, args) => {
    const answer = await tool(name, args);
    if (answer.result?.isError || !answer.result?.structuredContent) throw new Error(`Browser preparation ${name} failed (${answer.result?._meta?.['com.runeditrun/error']?.code ?? answer.status})`);
    return answer.result.structuredContent;
  };
  await c.adopt(autonomousPolicy());
  const project = await done('vector.proj.project_record', { name: 'Checkout reliability', leadOperatorId: session.operatorId });
  const issue = await done('vector.issue.creation', { teamId: options.teams[0].id, projectId: project.id,
    title: 'Checkout stalls after selecting a saved address', description: 'Investigate the customer report, retain reproduction evidence and inspect the proposed fix.' });
  const comment = await done('vector.issue.comments_and_safe_comment_removal', { identifier: issue.identifier,
    input: { body: 'Reproduced against the native checkout. Morgan will review the retained evidence before anything is removed.' } });
  const document = await done('vector.proj.project_documents_and_specs', { parentKind: 'project', parentId: project.id,
    title: 'Checkout investigation', body: 'Reproduction, implementation notes and the named reviewer’s decision remain separate facts.' });
  const currentIssue = await c.personJson('/api/issues/' + issue.identifier);
  const humanEdit = await c.personRequest('/api/issues/' + issue.identifier, { method: 'PATCH',
    body: JSON.stringify({ expectedVersion: currentIssue.version, title: 'Checkout stalls after selecting a saved address — reviewed by Morgan' }) });
  if (!humanEdit.ok) throw new Error('Native person edit failed');
  await humanEdit.body?.cancel();
  const personEvents = await db.prepare("SELECT count(*) n FROM agent_door_events WHERE json_extract(event,'$.actor.kind')='person' AND json_extract(event,'$.actor.person.id')=?")
    .bind(session.operatorId).first('n');
  if (!personEvents) throw new Error('Native person edit was not mirrored through door.emit');
  console.log('Native person event mirror: ' + personEvents);
  for (const [path, body, uri] of [
    ['/api/settings/projects/' + project.id, { description: 'Morgan reviewed the retained investigation evidence.' }, 'vector://projects/' + project.id],
    ['/api/documents/' + document.id, { expectedVersion: document.version, body: 'Morgan reviewed the retained reproduction notes; the agent prepared the original document.' }, 'vector://documents/' + document.id],
  ]) {
    const response = await c.personRequest(path, { method: 'PATCH', body: JSON.stringify(body) });
    if (!response.ok) throw new Error('Native person planning edit failed: ' + response.status);
    await response.body?.cancel();
    const mirrored = await db.prepare("SELECT count(*) n FROM agent_door_events WHERE uri=? AND json_extract(event,'$.actor.kind')='person' AND json_extract(event,'$.actor.person.id')=?")
      .bind(uri, session.operatorId).first('n');
    if (!mirrored) throw new Error('Native person planning edit was not mirrored through door.emit');
    console.log('Native person planning event mirror: ' + uri + ' count=' + mirrored);
  }

  const milestone = await done('vector.proj.milestones', { id: project.id, input: { name: 'Old investigation checkpoint' } });
  await c.adopt(heldPolicy());
  const pending = await tool('vector.proj.milestones.delete', { id: project.id, milestoneId: milestone.id });
  const approval = pending.result?._meta?.['com.runeditrun/approval'];
  if (!approval?.url) throw new Error('Browser preparation did not create a native approval');
  await mkdir('../screens-final', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const captured = [];
  try {
    const context = await browser.newContext();
    await context.addCookies(person.cookie.split('; ').map(entry => {
      const equals = entry.indexOf('='); return { name: entry.slice(0, equals), value: entry.slice(equals + 1), url: origin, secure: true, httpOnly: true };
    }));
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== origin) return route.abort();
      const incoming = route.request();
      const response = await request(incoming.url(), { method: incoming.method(), headers: incoming.headers(),
        ...(incoming.postDataBuffer() ? { body: incoming.postDataBuffer() } : {}) });
      const headers = Object.fromEntries(response.headers); delete headers['content-encoding']; delete headers['content-length'];
      await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    });
    const page = await context.newPage();
    const capture = async (name, path) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 }); await page.goto(new URL(path, origin).href);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        if (overflow) throw new Error(`${name} has horizontal overflow at ${width}`);
        const outputPath = `../screens-final/${name}-${width}.png`;
        await page.screenshot({ path: outputPath, fullPage: true });
        console.log(`VECTOR_SCREEN ${name}-${width}.png ${(await readFile(outputPath)).toString('base64')}`);
        captured.push({ name, width, heading: await page.locator('h1').allTextContents(), overflow });
      }
    };
    await capture('approval-pending', approval.url);
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-approval-state]')?.textContent !== 'pending');
    await capture('approval-final', approval.url);
    await capture('agents-review', '/agents');
    await page.getByRole('button', { name: 'Pause agents', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Agents are paused'));
    await capture('agents-paused', '/agents');
    await page.getByRole('button', { name: 'Resume local agents', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Agents are not paused'));
    const blocked = autonomousPolicy(); blocked.rules.push({ id: 'retain-records', class: 'destructive', do: 'blocked' });
    await c.adopt(blocked);
    const refusal = await tool('vector.issue.remove_comment', { identifier: issue.identifier, itemId: comment.id, input: { expectedVersion: 0 } });
    if (refusal.decision?.disposition !== 'blocked') throw new Error('Browser blocked policy did not refuse before native arguments');
    await capture('agents-blocked', '/agents');
    await capture('approval-error', '/agents/approvals/unavailable');
    await capture('native-issue', '/app/issues/' + issue.identifier);
    await capture('native-project', '/app/projects/' + project.id);
    await capture('native-document', '/app/documents/' + document.id);
    await capture('native-audit', '/app/settings/audit');
    await capture('native-inbox', '/app/inbox');
    await context.close();
  } finally { await browser.close(); }
  for (const row of captured) console.log('BROWSER ' + JSON.stringify(row));
  console.log(`Browser product path: ${captured.length} screens at 1440 and 390.`);
}
