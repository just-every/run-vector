import test from 'node:test';
import assert from 'node:assert/strict';
import { sendDevelopment } from '../../src/development/index.mjs';
import { MailValidationError } from '../../src/core/errors.mjs';
import { applyUnsubscribeHeaders } from '../../src/unsubscribe/index.mjs';
import { createFixtureOutbox } from '../fixtures/development-outbox.mjs';

const config = () => ({ provider: 'development', mode: 'development' });
const message = () => ({
  deliveryId: 'dev-17',
  from: 'Sender <sender@example.com>',
  to: ['reader@example.net'],
  subject: 'Hello',
  text: 'Plain body',
  attachments: [{ filename: 'raw.bin', contentType: 'application/octet-stream', content: Uint8Array.of(0, 255, 128, 10) }],
});
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof MailValidationError && error.code === code && !error.message.includes('SENSITIVE'));

test('development outbox stores a detached exact message and returns a local-only result', async () => {
  const outbox = createFixtureOutbox();
  let networkCalls = 0;
  const input = message();
  const originalBytes = input.attachments[0].content;
  const originalSnapshot = structuredClone(input);
  const dispatched = applyUnsubscribeHeaders({ ...input, unsubscribe: {
    url: 'https://example.com/leave?id=17', mailto: 'leave@example.com', oneClick: true,
  } });

  const result = await sendDevelopment(config(), dispatched, {
    outbox,
    fetch: async () => { networkCalls += 1; throw new Error('SENSITIVE fetch failure'); },
  });

  assert.deepEqual(result, { provider: 'development', status: 'development', providerMessageId: null });
  assert.equal(networkCalls, 0);
  assert.deepEqual(outbox.messages(), [dispatched]);
  const stored = outbox.messages()[0];
  assert.notEqual(stored, dispatched);
  assert.notEqual(stored.attachments[0].content, dispatched.attachments[0].content);
  assert.deepEqual([...stored.attachments[0].content], [0, 255, 128, 10]);
  assert.deepEqual([...input.attachments[0].content], [...originalBytes]);
  assert.deepEqual(input, originalSnapshot);
  assert.equal('unsubscribe' in stored, false);
  assert.equal(stored.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('development path requires the explicit provider, mode, and asynchronous outbox before capture', async () => {
  let writes = 0;
  const outbox = { async put() { writes += 1; } };

  await rejectsCode(sendDevelopment({ provider: 'sendgrid', mode: 'production' }, message(), { outbox }), 'api_key_required');
  await rejectsCode(sendDevelopment({ provider: 'sendgrid', mode: 'production', apiKey: 'remote-key' }, message(), { outbox }), 'development_provider_required');
  await rejectsCode(sendDevelopment({ provider: 'development', mode: 'production' }, message(), { outbox }), 'development_mode_required');
  await rejectsCode(sendDevelopment(config(), message()), 'development_outbox_required');
  await rejectsCode(sendDevelopment(config(), message(), { outbox: {} }), 'development_outbox_required');
  assert.equal(writes, 0);
});

test('caller changes during an asynchronous outbox write cannot alter the captured bytes', async () => {
  const input = message();
  let captured;
  let finishWrite;
  const writeGate = new Promise(resolve => { finishWrite = resolve; });
  const pending = sendDevelopment(config(), input, {
    outbox: {
      async put(snapshot) {
        captured = snapshot;
        await writeGate;
      },
    },
  });

  input.subject = 'changed by caller';
  input.attachments[0].content.fill(3);
  finishWrite();
  await pending;

  assert.equal(captured.subject, 'Hello');
  assert.deepEqual([...captured.attachments[0].content], [0, 255, 128, 10]);
  assert.deepEqual([...input.attachments[0].content], [3, 3, 3, 3]);
});

test('unconsumed unsubscribe requests and outbox failures reject without leaking details', async () => {
  let writes = 0;
  const outbox = { async put() { writes += 1; throw new Error('SENSITIVE storage path'); } };

  await rejectsCode(sendDevelopment(config(), { ...message(), unsubscribe: { url: 'https://example.com/u' } }, { outbox }), 'unsubscribe_not_assembled');
  assert.equal(writes, 0);
  await rejectsCode(sendDevelopment(config(), message(), { outbox }), 'development_outbox_failed');
  assert.equal(writes, 1);
});
