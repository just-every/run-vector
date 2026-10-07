import test from 'node:test';
import assert from 'node:assert/strict';
import { mailDoctor } from '../../src/doctor/index.mjs';
import { checkDns, resolveDns, decodeTxt } from '../../src/doctor/dns.mjs';
import { dnsPlan, recordPlan } from '../../src/doctor/records.mjs';

const records = {
  mx: [{ type: 'MX', name: 'mail.example.com', value: 'mx.provider.example', priority: 10 }],
  spf: [{ type: 'TXT', name: 'return.mail.example.com', value: 'v=spf1 include:provider.example ~all' }],
  dkim: [{ type: 'CNAME', name: 'chosen._domainkey.mail.example.com', value: 'dkim.provider.example' }],
  dmarc: [{ type: 'TXT', name: '_dmarc.mail.example.com', value: 'v=DMARC1; p=none' }],
};
const planned = () => dnsPlan('mail.example.com', 'resend', recordPlan(records));

test('offline plan names all six items and never treats supplied records as evidence', async () => {
  const result = await mailDoctor({ domain: 'MAIL.EXAMPLE.COM.', provider: 'resend', dnsRecords: records }, {
    fetch() { assert.fail('offline fetch'); }, resolveDns() { assert.fail('offline DNS'); }, sender: { send() { assert.fail('offline send'); } },
  });
  assert.equal(result.domain, 'mail.example.com');
  assert.deepEqual(result.items.map(row => row.id), ['mx', 'spf', 'dkim', 'dmarc', 'send', 'receive']);
  for (const item of result.items) { assert.ok(['pending', 'not_checked'].includes(item.status)); assert.ok(item.nextSteps.length); }
  assert.deepEqual(result.items[2].records, records.dkim);
});

test('sample without provider setup explains selector and values without manufacturing DKIM', async () => {
  const result = await mailDoctor({ domain: 'mail.example.com', provider: 'cloudflare' });
  assert.ok(result.items.slice(0, 4).every(item => item.records.length === 0));
  assert.match(result.items[2].nextSteps[0], /Copy every cloudflare DKIM selector/);
});

test('DNS exact matches and canonical host casing/terminal dots pass', async () => {
  const result = await checkDns(planned(), { resolveDns: async query => ({ status: 'ok', records: Object.values(records).flat().filter(row => row.name === query.name).map(row => ({ ...row, name: row.name.toUpperCase() + '.', ...(row.type === 'TXT' ? {} : { value: row.value.toUpperCase() + '.' }) })) }) });
  assert.ok(result.every(item => item.status === 'pass'));
  assert.ok(result.every(item => item.evidence.state === 'match'));
});

test('DNS distinguishes missing, mismatch, resolver error, and unchecked', async () => {
  const result = await checkDns([...planned().slice(0, 3), { ...planned()[3], records: [] }], { resolveDns: async query => {
    if (query.type === 'MX') return { status: 'missing', records: [] };
    if (query.type === 'TXT') return { status: 'ok', records: [{ ...records.spf[0], value: 'v=spf1 -all' }] };
    throw new Error('secret must not escape');
  } });
  assert.deepEqual(result.map(row => row.evidence.state), ['missing', 'mismatch', 'error', 'unchecked']);
  assert.doesNotMatch(JSON.stringify(result), /secret must/);
});

test('priority mismatch and duplicate SPF/DMARC policies fail even with a matching row', async () => {
  const result = await checkDns(planned(), { resolveDns: async query => ({ status: 'ok', records: Object.values(records).flat().filter(row => row.name === query.name).flatMap(row => row.type === 'MX' ? [{ ...row, priority: 20 }] : row.type === 'TXT' ? [row, { ...row, value: row.value + ' extra' }] : [row]) }) });
  assert.deepEqual(result.map(row => row.evidence.state), ['mismatch', 'mismatch', 'match', 'mismatch']);
});

test('DNS malformed or contradictory resolver results are errors, never missing', async () => {
  for (const response of [null, { status: 'okay', records: [] }, { status: 'ok', records: 'bad' }, { status: 'missing', records: records.mx }]) {
    const [result] = await checkDns(planned().slice(0, 1), { resolveDns: async () => response });
    assert.equal(result.evidence.state, 'error');
  }
});

test('fixed DNS-over-HTTPS request decodes chunked TXT and refuses redirects/errors', async () => {
  const query = { name: 'mail.example.com', type: 'TXT', signal: new AbortController().signal };
  const result = await resolveDns(query, async (url, init) => {
    assert.equal(url.origin, 'https://cloudflare-dns.com');
    assert.equal(url.searchParams.get('type'), 'TXT');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.accept, 'application/dns-json');
    return Response.json({ Status: 0, Answer: [{ type: 16, name: 'mail.example.com.', data: '"v=spf1 " "-all"' }] });
  });
  assert.equal(result.records[0].value, 'v=spf1 -all');
  assert.equal((await resolveDns(query, async () => new Response(null, { status: 302 }))).status, 'error');
  assert.equal((await resolveDns(query, async () => Response.json({ Status: 2 }))).status, 'error');
  assert.equal((await resolveDns(query, async () => Response.json({ Status: 3 }))).status, 'missing');
});

test('TXT presentation escape handling rejects malformed data', () => {
  assert.equal(decodeTxt('"v=DKIM1; " "p=ab\\099"'), 'v=DKIM1; p=abc');
  for (const value of ['"open', 'unquoted', '"a"junk', '"\\999"']) assert.throws(() => decodeTxt(value));
});

test('record schema rejects wrong types, overflow, keys, selector and policy errors', () => {
  for (const input of [
    { mx: [{ ...records.mx[0], priority: -1 }] },
    { mx: [{ ...records.mx[0], type: 'TXT' }] },
    { spf: [{ ...records.spf[0], value: 'arbitrary string' }] },
    { dkim: [{ ...records.dkim[0], name: 'missing.mail.example.com' }] },
    { dmarc: [{ ...records.dmarc[0], value: 'v=spf1 -all' }] },
    { mx: Array(33).fill(records.mx[0]) }, { apiKey: 'private' },
  ]) assert.throws(() => recordPlan(input));
});
