import module from '../../../../vendor/base/egress-service/tls/egress.wasm';
import { connect } from 'cloudflare:sockets';
import { rustls } from '../../../../vendor/base/egress-service/rustls';
import { dohResolver } from '../../../../vendor/base/egress-service/doh';
import { EgressTransport } from '../../../../vendor/base/egress-service/transport';

/** The same enforcing transport as Base's service, kept inside this installation's Worker. */
export function nativeEgress(ownership) {
  return new EgressTransport({
    resolve: dohResolver((input, init) => fetch(input, init)), connect,
    fetch: (url, init) => fetch(url, init),
  }, { ownership, tls: rustls(module) });
}

/** DESIGN-001 uses fixed Figma API and image hosts, with no credential forwarding
 * from the API to the image CDN and no provider-controlled redirect. */
export function figmaEgress(value, init) {
  const url = new URL(value), method = init.method ?? 'GET', headers = new Headers(init.headers);
  const api = url.origin === 'https://api.figma.com' &&
    ((method === 'POST' && url.pathname === '/v1/oauth/token') ||
      (method === 'GET' && /^\/v1\/(?:files\/[A-Za-z0-9]{1,128}\/nodes|images\/[A-Za-z0-9]{1,128})$/.test(url.pathname)));
  const image = url.protocol === 'https:' && ['s3-alpha.figma.com', 's3-alpha-sig.figma.com'].includes(url.hostname) &&
    !url.port && /^\/img\/[A-Za-z0-9/_-]+$/.test(url.pathname) && method === 'GET' && !headers.has('Authorization');
  if ((!api && !image) || url.username || url.password || url.hash || headers.has('Cookie') || headers.has('Origin')) throw Error('Figma destination refused');
  return fetch(url.href, { ...init, redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer' });
}
