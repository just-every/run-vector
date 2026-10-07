import test from 'node:test';
import assert from 'node:assert/strict';
import { sendDevelopment } from '../../src/development/index.mjs';
import { MailValidationError } from '../../src/core/errors.mjs';
import { applyUnsubscribeHeaders } from '../../src/unsubscribe/index.mjs';

const message = (overrides = {}) => ({
  deliveryId: 'mail-23',
  from: 'Sender <sender@example.com>',
  to: ['reader@example.net'],
  subject: 'Receipt',
  text: 'Your receipt',
  headers: { 'X-Trace': 'trace-7', 'Message-ID': '<current@example.com>', References: '<first@example.com> <previous@example.com>' },
  ...overrides,
});
const rejectsCode = (operation, code) => assert.throws(operation, error => error instanceof MailValidationError && error.code === code && !error.message.includes('SENSITIVE'));
const rejectsPromiseCode = (promise, code) => assert.rejects(promise, error => error instanceof MailValidationError && error.code === code && !error.message.includes('SENSITIVE'));
const rejectsValidation = operation => assert.throws(operation, error => error instanceof MailValidationError && !error.message.includes('SENSITIVE'));

test('HTTPS, optional mailto, and one-click headers are assembled without mutating input', () => {
  const input = message({ unsubscribe: {
    url: 'https://example.com/unsubscribe?token=abc', mailto: 'mailto:leave@example.com', oneClick: true,
  } });
  const original = structuredClone(input);
  const prepared = applyUnsubscribeHeaders(input);

  assert.notEqual(prepared, input);
  assert.notEqual(prepared.headers, input.headers);
  assert.deepEqual(prepared.headers, {
    'X-Trace': 'trace-7',
    'Message-ID': '<current@example.com>',
    References: '<first@example.com> <previous@example.com>',
    'List-Unsubscribe': '<https://example.com/unsubscribe?token=abc>, <mailto:leave@example.com>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
  assert.equal('unsubscribe' in prepared, false);
  assert.deepEqual(input, original);
});

test('HTTPS-only assembly omits one-click and retains matching custom headers', () => {
  const prepared = applyUnsubscribeHeaders(message({
    headers: { 'X-Trace': 'trace-7', 'list-unsubscribe': '<https://example.com/u>' },
    unsubscribe: { url: 'https://example.com/u' },
  }));
  assert.equal(prepared.headers['list-unsubscribe'], '<https://example.com/u>');
  assert.equal(prepared.headers['List-Unsubscribe-Post'], undefined);
  assert.equal(prepared.headers['X-Trace'], 'trace-7');
});

test('unsafe URL and mailbox inputs fail closed', () => {
  for (const url of [
    'http://example.com/u',
    'javascript:alert(1)',
    'https://user:pass@example.com/u',
    'https://example.com/u\r\nBcc:attacker@example.net',
    'https://example.com/u%0d%0aBcc:attacker',
    'https://example.com/u%25250aBcc:attacker',
    'https://example.com/%3cBcc%3e',
    'https://example.com/<Bcc>',
    'https://example.com\\@attacker.example/u',
  ]) {
    rejectsCode(() => applyUnsubscribeHeaders(message({ unsubscribe: { url } })), 'invalid_unsubscribe_url');
  }

  for (const mailto of [
    'person@example.com\r\nBcc:attacker@example.net',
    'person@example.com%0d%0aBcc:attacker',
    'person@example.com%25250dBcc:attacker',
    '<person@example.com>',
    'person@example.com,attacker@example.net',
    'person@example.com?subject=leave',
  ]) {
    rejectsValidation(() => applyUnsubscribeHeaders(message({ unsubscribe: { url: 'https://example.com/u', mailto } })));
  }
});

test('custom list headers must agree with the structured unsubscribe request', () => {
  rejectsCode(() => applyUnsubscribeHeaders(message({
    headers: { 'List-Unsubscribe': '<https://other.example/u>' },
    unsubscribe: { url: 'https://example.com/u' },
  })), 'unsubscribe_header_conflict');
  rejectsCode(() => applyUnsubscribeHeaders(message({
    headers: { 'list-unsubscribe-post': 'List-Unsubscribe=One-Click' },
    unsubscribe: { url: 'https://example.com/u' },
  })), 'invalid_list_unsubscribe_post');
  rejectsCode(() => applyUnsubscribeHeaders(message({
    headers: { 'List-Unsubscribe': '<https://example.com/u>', 'list-unsubscribe': '<https://example.com/u>' },
    unsubscribe: { url: 'https://example.com/u' },
  })), 'reserved_or_duplicate_header');
  rejectsCode(() => applyUnsubscribeHeaders(message({
    headers: { 'List-Unsubscribe': '<https://example.com/u>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click; extra=value' },
  })), 'invalid_list_unsubscribe_post');
});

test('header conflicts and duplicate names fail before the development outbox is called', async () => {
  let writes = 0;
  const outbox = { async put() { writes += 1; } };
  const dispatch = async input => sendDevelopment(
    { provider: 'development', mode: 'development' },
    applyUnsubscribeHeaders(input),
    { outbox },
  );

  await rejectsPromiseCode(dispatch(message({
    headers: { 'List-Unsubscribe': '<https://other.example/u>' },
    unsubscribe: { url: 'https://example.com/u' },
  })), 'unsubscribe_header_conflict');
  await rejectsPromiseCode(dispatch(message({
    headers: {
      'List-Unsubscribe': '<https://example.com/u>',
      'list-unsubscribe': '<https://example.com/u>',
    },
    unsubscribe: { url: 'https://example.com/u' },
  })), 'reserved_or_duplicate_header');
  assert.equal(writes, 0);
});

test('valid custom list headers are preserved, while malformed or injected values fail', () => {
  const custom = {
    'List-Unsubscribe': '<https://example.com/u?a=1,2>, <mailto:leave@example.com>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
  assert.deepEqual(applyUnsubscribeHeaders(message({ headers: custom })).headers, custom);

  for (const headers of [
    { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    { 'List-Unsubscribe': '<http://example.com/u>' },
    { 'List-Unsubscribe': '<https://example.com/u%0d%0aBcc:attacker>' },
    { 'List-Unsubscribe': '<mailto:reader@example.com%25250aBcc:attacker>' },
    { 'List-Unsubscribe': '<javascript:alert(1)>' },
    { 'List-Unsubscribe': '<https://example.com/u>, ' },
    { 'List-Unsubscribe': '<https://example.com/u> <https://other.example/u>' },
  ]) {
    rejectsCode(() => applyUnsubscribeHeaders(message({ headers })), headers['List-Unsubscribe-Post'] ? 'invalid_list_unsubscribe_post' : 'invalid_list_unsubscribe');
  }
});
