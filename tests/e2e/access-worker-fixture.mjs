// Test-only transport around the real emitted Worker. No response or SQL result
// is fabricated: HTTPS configuration and final-read revocation exercise D1.
import worker from './index.js';
// The emitted config binds the restore coordinator to this entry's export.
export { VectorRestoreCoordinator } from './index.js';
// Match the final actor/session classifier, independently of its SELECT fields.
// Earlier session admission and resource projections must finish before revocation.
const finalAdmission = sql => /\bFROM operators actor WHERE actor\.id=\? AND actor\.removed_at IS NULL\s*$/.test(sql)
 && sql.includes('JOIN oa_sessions s ON s.operator_id=m.auth_id');
export default {
 async fetch(incoming, env, execution) {
  const url = new URL(incoming.url);
  const canonical = new URL(env.APP_ORIGIN);
  url.protocol = canonical.protocol;
  const headers = new Headers(incoming.headers);
  if (headers.has('origin')) {
   const origin = new URL(headers.get('origin'));
   if (origin.host === canonical.host) { origin.protocol = canonical.protocol; headers.set('origin', origin.origin); }
  }
  const request = new Request(url, {...incoming, method:incoming.method, headers, body:['GET','HEAD'].includes(incoming.method)?undefined:incoming.body});
  const session = request.headers.get('x-vector-test-revoke');
  let fired = false;
  const db = new Proxy(env.DB, {get(target, key) {
   if (key === 'prepare') return sql => wrap(target.prepare(sql), sql);
   const value = Reflect.get(target, key, target);
   return typeof value === 'function' ? value.bind(target) : value;
  }});
  function wrap(statement, sql) {
   return new Proxy(statement, {get(target, key) {
    if (key === 'bind') return (...values) => wrap(target.bind(...values), sql);
    if (['first','all','run','raw'].includes(key)) return async (...args) => {
     if (session && !fired && finalAdmission(sql)) {
      fired = true;
      await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), session).run();
     }
     return target[key](...args);
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
   }});
  }
  const result = await worker.fetch(request, {...env, DB:db}, execution);
  const response = new Response(result.body, result);
  if (session) response.headers.set('x-vector-test-revoked', String(fired));
  return response;
 },
};
