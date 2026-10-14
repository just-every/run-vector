import { cloudflare as baseCloudflare } from '@runeditrun/rer/internal/modules/deploy-kit/provider.mjs';
import { assert } from '@runeditrun/rer/internal/modules/deploy-kit/validation.mjs';

/** R2's documented lexicographic start_after interface with an explicit page size.
 * result_info is optional; no fabricated cursor metadata is passed to Base.
 * https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/list/
 */
export function cloudflare(options) {
  const api = baseCloudflare(options);
  return { ...api, async list(path, settings = {}) {
    if (path !== '/r2/buckets' || settings.pagination === 'r2-bounded') return api.list(path, settings);
    assert(settings.field === 'buckets' && settings.pagination === 'cursor', 'invalid-r2-list-selection');
    const result = [];
    let after = '';
    for (let page = 0; page < 100; page++) {
      const envelope = await api.envelope(`/r2/buckets?order=name&direction=asc&per_page=100${after ? `&start_after=${encodeURIComponent(after)}` : ''}`);
      const rows = envelope.result?.buckets;
      assert(Array.isArray(rows) && rows.length <= 100, 'provider-invalid-r2-list');
      if (envelope.result_info !== undefined) {
        assert(envelope.result_info && typeof envelope.result_info === 'object', 'provider-invalid-r2-pagination');
        const { per_page, cursor } = envelope.result_info;
        assert(per_page === undefined || per_page === 100, 'provider-invalid-r2-page-size');
        assert(cursor === undefined || typeof cursor === 'string' && /^[a-zA-Z0-9_+\/=-]+$/.test(cursor), 'provider-invalid-r2-cursor');
      }
      for (const row of rows) {
        assert(typeof row?.name === 'string' && /^[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/.test(row.name) && row.name > after, 'provider-invalid-r2-order');
        after = row.name;
        result.push(row);
      }
      assert(result.length <= 10000, 'provider-list-too-large');
      if (rows.length < 100) {
        assert(!envelope.result_info?.cursor, 'provider-r2-partial-list');
        return result;
      }
    }
    throw new Error('provider-pagination-limit');
  } };
}
