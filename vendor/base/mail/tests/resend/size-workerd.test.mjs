import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

// This handler is embedded only in the test worker. Both paths import the same
// production ESM files used in Node; there is no application fixture provider.
async function exercise(request) {
  const params = new URL(request.url).searchParams;
  const scenario = params.get('case');
  const config = { provider: 'resend', mode: 'test', apiKey: 'workerd-size-fixture' };
  const input = { deliveryId: 'size-workerd', from: 's@example.test', to: ['r@example.test'], subject: '', text: 'x' };
  const part = content => ({ filename: 'p.bin', contentType: 'application/octet-stream', content });
  switch (scenario) {
    case 'ascii-over': input.text = 'x'.repeat(41 * 1024 * 1024); break;
    case 'utf8-text-over': input.text = '界'.repeat(5_000_000); break;
    case 'utf8-html-over': input.text = ''; input.html = '🙂'.repeat(3_300_000); break;
    case 'alternatives-over': input.text = 'x'.repeat(15_000_000); input.html = input.text; break;
    case 'base64-over': {
      const content = new Uint8Array(15_000_000);
      input.attachments = [part(content), part(content)]; break;
    }
    case 'metadata-over': input.bcc = Array(8000).fill(`${'名'.repeat(900)} <r@example.test>`); break;
    case 'near-boundary':
    case 'boundary-over': {
      // From the documented arithmetic, independent of the production estimator.
      const overhead = 1_000_000 + 6 * ('s@example.test'.length + 'r@example.test'.length) + 3 * 128 + 2048;
      let low = 0, high = 40_000_000;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2), encoded = 4 * Math.ceil(mid / 3);
        if (overhead + encoded + 2 * Math.ceil(encoded / 76) <= 40_000_000) low = mid;
        else high = mid - 1;
      }
      input.text = 'x'.repeat(low + (scenario === 'boundary-over' ? 1 : 0)); break;
    }
    case 'binary-valid': input.attachments = [part(Uint8Array.of(0, 255, 128, 13, 10))]; break;
    default: throw new Error('Unknown test scenario');
  }
  let calls = 0, writes = 0, encodes = 0, serializations = 0, bodyBytes = 0;
  const originalBase64 = globalThis.btoa, originalStringify = JSON.stringify;
  globalThis.btoa = value => { encodes++; return originalBase64(value); };
  JSON.stringify = (value, ...args) => {
    if (value && Object.hasOwn(value, 'from')) serializations++;
    return originalStringify(value, ...args);
  };
  let result, error, content;
  const dependencies = {
    fetch: async (url, init) => {
      calls++;
      if (url !== 'https://api.resend.com/emails' || init.redirect !== 'manual') throw new Error('Wrong provider request');
      bodyBytes = new TextEncoder().encode(init.body).byteLength;
      if (scenario === 'binary-valid') content = JSON.parse(init.body).attachments[0].content;
      return Response.json({ id: 'size-worker-receipt' });
    },
    outbox: { async put() { writes++; } },
  };
  try {
    result = params.get('path') === 'facade'
      ? await createMailSender(config, dependencies).send(input)
      : await sendResend(config, input, dependencies);
  } catch (cause) { error = { name: cause.name, code: cause.code }; }
  finally { globalThis.btoa = originalBase64; JSON.stringify = originalStringify; }
  return Response.json({ result, error, calls, writes, encodes, serializations, bodyBytes, content });
}

async function createSizeWorker(state) {
  const root = new URL('../../', import.meta.url);
  const modules = {};
  async function add(path) { modules[path] = { type: 'esm', contents: await readFile(new URL(path, root), 'utf8') }; }
  async function source(directory) {
    for (const item of await readdir(new URL(directory, root), { withFileTypes: true })) {
      if (item.isDirectory()) await source(`${directory}/${item.name}`);
      else if (item.name.endsWith('.mjs')) await add(`${directory}/${item.name}`);
    }
  }
  await source('src'); await add('index.mjs');
  modules['size-test-worker.mjs'] = { type: 'esm', contents: `
    import { createMailSender } from './index.mjs';
    import { sendResend } from './src/adapters/resend/index.mjs';
    export default { fetch: ${exercise.toString()} };
  ` };
  return new Miniflare({ cf: false, resourcePersistencePath: state, workers: [{ config: {
    type: 'worker', name: 'mail-size-test', compatibilityDate: '2026-09-01',
    manifest: { mainModule: 'size-test-worker.mjs', modulesRoot: fileURLToPath(root), modules },
  } }] });
}

test('Resend size rejection and legal boundary use real facade/adapter source in workerd', async t => {
  const state = await mkdtemp(join(tmpdir(), 'resend-size-'));
  let worker;
  try {
    worker = await createSizeWorker(state);
    for (const path of ['direct', 'facade']) {
      for (const scenario of ['ascii-over', 'utf8-text-over', 'utf8-html-over', 'alternatives-over', 'base64-over', 'metadata-over', 'boundary-over', 'near-boundary', 'binary-valid']) {
        await t.test(`${path}/${scenario}`, async () => {
          const response = await worker.dispatchFetch(`https://mail.test/?path=${path}&case=${scenario}`);
          assert.equal(response.status, 200);
          const data = await response.json();
          assert.equal(data.writes, 0);
          if (scenario === 'near-boundary' || scenario === 'binary-valid') {
            assert.equal(data.error, undefined);
            assert.deepEqual(data.result, { provider: 'resend', status: 'accepted', providerMessageId: 'size-worker-receipt' });
            assert.equal(data.calls, 1);
            assert.equal(data.serializations, 1);
            assert.ok(data.bodyBytes <= 39_000_000);
            if (scenario === 'near-boundary') assert.ok(data.bodyBytes > 28_000_000);
            else assert.equal(data.content, 'AP+ADQo=');
          } else {
            assert.deepEqual(data.error, { name: 'MailValidationError', code: 'resend_message_too_large' });
            assert.equal(data.result, undefined);
            assert.equal(data.calls, 0);
            assert.equal(data.encodes, 0);
            assert.equal(data.serializations, 0);
          }
        });
      }
    }
  } finally { await worker?.dispose(); await rm(state, { recursive: true, force: true }); }
});
