import { providerFixture } from './provider-fixture.mjs';

/** Independent schedule transport using the documented Cloudflare envelope.
 * Other resource behavior reuses the existing local SQLite test transport.
 * This does not alter the legacy fixture or make it accept multiple shapes.
 */
export function documentedProvider() {
  const fixture = providerFixture();
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const prefix = `/client/v4/accounts/${fixture.accountId}`;
    const path = url.pathname.slice(prefix.length);
    if (url.origin !== 'https://api.cloudflare.com' || !url.pathname.startsWith(prefix + '/') || !/^\/workers\/scripts\/[^/]+\/schedules$/.test(path)) return fixture.fetch(input, init);
    if (init.headers?.Authorization !== `Bearer ${fixture.token}`) throw new Error('wrong test credential');
    const method = init.method ?? 'GET';
    fixture.state.calls.push({method,path,search:url.search});
    if (!fixture.state.settings) return Response.json({success:false,errors:[{code:10007,message:'Worker not found'}]},{status:404});
    if (method === 'PUT') {
      const body = JSON.parse(init.body);
      fixture.state.writes.push({method,path,body});
      fixture.state.schedules = body.map(row => ({...row,created_on:'2026-10-06T00:00:00Z',modified_on:'2026-10-06T00:00:00Z'}));
    } else if (method !== 'GET') throw new Error('unexpected schedule method');
    return Response.json({success:true,errors:[],messages:[],result:{schedules:fixture.state.schedules}});
  };
  return {...fixture,fetch};
}
