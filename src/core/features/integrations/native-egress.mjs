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
