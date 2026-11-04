import type { AgentDoorOptions, Runtime } from '../../../../vendor/base/agent-door/index.ts';
import { registry } from '../../../../vendor/base/agent-door/registry.ts';
import { discovery } from '../../../../vendor/base/agent-door/wire.ts';
import { policyState, policyRefusal } from '../../../../vendor/base/agent-door/policy-store.ts';
import { answered } from '../../../../vendor/base/agent-door/policy/document.ts';
import { pageStyle } from '../../../../vendor/base/agent-door/page-style.ts';
import type { DocumentedTool } from './registry';

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const source = (path: string) => `https://github.com/just-every/run-vector/blob/main/${path}`;
const errors = [
  ['insufficient_scope', 'The grant lacks a required scope.'],
  ['policy_unset', 'A complete company policy is required before agent work.'],
  ['policy_unavailable', 'The paired policy has expired.'],
  ['agents_paused', 'A person has paused agent access.'],
  ['policy_blocked', 'The policy refuses this action.'],
  ['approval_required', 'A person must approve at the returned URL.'],
  ['revision_conflict', 'Reload the current revision before preparing another change.'],
  ['idempotency_conflict', 'The key was already used with different arguments.'],
  ['resource_unavailable', 'The record is missing or outside current access.'],
  ['rate_limited', 'Retry after the number of seconds in Retry-After.'],
  ['capability_not_declared', 'This installation does not offer the requested family.'],
];

/** A native session admits the document; no record read or classifier runs here. */
export async function agentDocumentation(options: AgentDoorOptions, request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
  if (new URL(request.url).origin !== options.origin ||
      request.headers.has('origin') && request.headers.get('origin') !== options.origin ||
      ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site') ?? ''))
    return new Response('Forbidden', { status: 403, headers });
  const person = request.headers.has('authorization') ? null : await options.people.session(request);
  if (!person?.active) return new Response('Sign in to read agent documentation.', { status: 401, headers });
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  const runtime: Runtime = { options, tools: registry(options), now: options.now ?? Date.now };
  const state = await policyState(runtime), info = discovery(runtime);
  const tools = policyRefusal(runtime, state, []) ? [] : runtime.tools.filter(tool =>
    tool.exposure !== 'invoke' && tool.classes.every(cls => answered(state.document, cls))) as DocumentedTool[];
  const resources = policyRefusal(runtime, state, ['standard']) ? [] : [...options.resources ?? []]
    .sort((a, b) => a.uriTemplate.localeCompare(b.uriTemplate));
  const jobs = [...new Set(tools.map(tool => tool.documentation.job))].sort();
  const content = jobs.map(job => `<section aria-label="${escape(job)}"><h2>${escape(job)}</h2>${tools
    .filter(tool => tool.documentation.job === job).map(tool => `<article data-tool="${escape(tool.name)}">
      <h3>${escape(tool.title)}</h3><code data-tool-name>${escape(tool.name)}</code><p>${escape(tool.description)}</p>
      <dl class="fields"><div><dt>Scope</dt><dd data-scope>${escape(tool.scope)}</dd></div>
      <div><dt>Effect</dt><dd>${tool.readOnly ? 'Read only' : 'Native record change; idempotency key required'}</dd></div>
      <div><dt>Classes and proof</dt><dd><ul>${tool.classes.map(cls => {
        const proof = tool.documentation.classes[cls];
        if (!proof) throw new Error('Missing native class documentation');
        return `<li data-class="${escape(cls)}"><strong>${escape(cls)}</strong> —
          <a data-fixture="${escape(proof.fixture)}" data-step="${escape(proof.step)}" href="${source(proof.fixture)}">${escape(proof.fixture)} · ${escape(proof.step)}</a>;
          <a data-test="${escape(proof.test)}" data-assertion="${escape(proof.assertion)}" href="${source(proof.test)}">${escape(proof.test)} · ${escape(proof.assertion)}</a></li>`;
      }).join('')}</ul></dd></div></dl></article>`).join('')}</section>`).join('');
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Agent documentation · ${escape(options.name)}</title><style nonce="${nonce}">${pageStyle}
    :root{--rer-font-body:system-ui,sans-serif;--rer-font-heading:system-ui,sans-serif}
    article{margin-top:24px;min-width:0}code{overflow-wrap:anywhere;font-size:14px}li{overflow-wrap:anywhere}
    .fields a{display:inline;min-height:0}.fields li{margin-block:8px}nav a{min-height:44px}
    </style><link rel="stylesheet" href="/rer-theme.css"></head><body>
    <a class="skip" href="#main">Skip to content</a><header><a href="/app">${escape(options.name)}</a>
    <nav aria-label="Main"><a href="/agents">Agents</a><a href="/docs/agents" aria-current="page">Agent documentation</a></nav></header>
    <main id="main" tabindex="-1"><h1>Agent documentation</h1><p data-specialist>${escape(options.specialist)}</p>
    <p>${escape(info.instructions)}</p><p>This catalogue describes the installation. Each caller still needs the listed scopes and current native access. Resource lists can be narrower for a caller's grant.</p>
    <nav aria-label="Documentation"><a href="#tools">Tools by job</a><a href="#resources">Resources</a><a href="#limits">Capacity and errors</a></nav>
    <h2 id="tools">Tools by job</h2>${content || '<p>No tools are currently offered. Review policy and Pause on the Agents page.</p>'}
    <section aria-labelledby="resources"><h2 id="resources">Resources</h2><ul>${resources.map(resource =>
      `<li data-resource="${escape(resource.uriTemplate)}"><h3 data-resource-name>${escape(resource.name)}</h3>
      <code>${escape(resource.uriTemplate)}</code><p>Scope: <code data-scope>${escape(resource.scope ?? 'None')}</code>. Classes: ${escape(resource.classes.join(', '))}. Format: ${escape(resource.mimeType)}.</p></li>`).join('')}</ul>
    ${resources.length ? '' : '<p>No resource templates are currently offered.</p>'}</section>
    <section aria-labelledby="capabilities"><h2 id="capabilities">Supported capabilities</h2>
    <ul>${(options.capabilities ?? []).map(capability => `<li data-capability="${escape(capability)}">${escape(capability)}</li>`).join('')}</ul>
    <p>Unsupported families: ${escape(info._meta['com.runeditrun/capabilities'].refused.join(', '))}. The current native journey covers declared issue work and issue and comment resources; the wider specialist week is incomplete. No provider spending tools are offered.</p></section>
    <section aria-labelledby="limits"><h2 id="limits">Capacity and errors</h2><dl class="fields">
    <div><dt>Requests per minute</dt><dd data-limit="requestsPerMinute">${options.limits!.requestsPerMinute}</dd></div>
    <div><dt>Maximum body bytes</dt><dd data-limit="maxBodyBytes">${options.limits!.maxBodyBytes}</dd></div></dl>
    <p>These installation safeguards bound request rate and size. Company policy governs business decisions; capacity limits are not daily business-volume caps.</p>
    <p>A missing, expired or revoked credential returns HTTP 401. Foreign Origin and method-header mismatches are refused; an unsupported protocol returns UnsupportedProtocolVersion. Oversized requests return HTTP 413 without an effect. Business refusals carry a stable code and isError; native validation and permission refusals retain their native code.</p>
    <dl class="fields">${errors.map(([code, message]) => `<div><dt><code>${code}</code></dt><dd>${message}</dd></div>`).join('')}</dl></section>
    </main></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { headers: { ...headers,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; font-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
  } });
}
