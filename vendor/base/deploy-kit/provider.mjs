import { assert, hexId } from './validation.mjs';

export async function boundedJSON(response, limit = 4 * 1024 * 1024) {
  assert(response.body, 'empty-response');
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; assert(length <= limit, 'response-too-large'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('malformed-response'); }
}
/** Only this fixed origin and the explicitly selected account ever receive the token. */
export function cloudflare({ accountId, token, fetch: request = globalThis.fetch, timeoutMs = 30000, maxRequests = 500 }) {
  assert(hexId(accountId), 'missing-or-invalid-CF_THROWAWAY_ACCOUNT_ID');
  assert(typeof token === 'string' && token.trim() && !/[\r\n]/.test(token), 'missing-or-invalid-CF_THROWAWAY_API_TOKEN');
  let requests = 0;
  async function envelope(path, { method = 'GET', body, assetToken } = {}) {
    assert(typeof path === 'string' && /^\/[a-z0-9/_?=&.,%-]+$/i.test(path) && !path.includes('..') && !path.split('?')[0].includes('%'), 'invalid-provider-path');
    assert(++requests <= maxRequests, 'provider-request-budget');
    assert(!assetToken || path === '/workers/assets/upload?base64=true', 'invalid-asset-auth-target');
    const signal = AbortSignal.timeout(timeoutMs);
    let response;
    try { response = await request(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
      method, redirect: 'error', signal, headers: { Authorization: `Bearer ${assetToken ?? token}`, ...(body && !(body instanceof FormData) ? { 'Content-Type':'application/json' } : {}) },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    }); } catch { throw new Error('provider-transport-failed'); }
    if (!response.ok) { const error = new Error(`provider-http-${response.status}`); error.status = response.status; await response.body?.cancel(); throw error; }
    const payload = await boundedJSON(response);
    assert(payload?.success === true && Object.hasOwn(payload,'result') && (!payload.errors || Array.isArray(payload.errors) && !payload.errors.length), 'provider-unsuccessful-or-malformed');
    return payload;
  }
  async function list(path, { field, pagination = 'page' } = {}) {
    const result = []; const seen = new Set(); let cursor; let total;
    for (let page = 1; page <= 100; page++) {
      const suffix = pagination === 'cursor' ? (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '') : `?page=${page}&per_page=100`;
      const data = await envelope(path + suffix); const rows = field ? data.result?.[field] : data.result;
      assert(Array.isArray(rows), 'provider-invalid-list');
      result.push(...rows); assert(result.length <= 10000, 'provider-list-too-large');
      if (pagination === 'cursor') {
        const info = data.result_info; assert(info && Number.isSafeInteger(info.per_page) && info.per_page > 0, 'provider-incomplete-pagination');
        if (!info.cursor) { assert(rows.length < info.per_page, 'provider-partial-list'); return result; }
        cursor = info.cursor; assert(typeof cursor === 'string' && /^[a-zA-Z0-9_+\/=-]+$/.test(cursor) && !seen.has(cursor), 'provider-invalid-cursor'); seen.add(cursor);
      } else {
        const info = data.result_info;
        assert(info && info.page === page && Number.isSafeInteger(info.total_count) && info.total_count >= 0, 'provider-incomplete-pagination');
        total ??= info.total_count; assert(total === info.total_count, 'provider-pagination-changed');
        assert(result.length <= total, 'provider-partial-list');
        if (result.length === total) return result;
        assert(rows.length > 0 && (info.total_pages === undefined || page < info.total_pages), 'provider-partial-list');
      }
    }
    throw new Error('provider-pagination-limit');
  }
  return { accountId, envelope, list, async request(path, options) { return (await envelope(path, options)).result; } };
}
