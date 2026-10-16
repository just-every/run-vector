/** Compress at the origin while keeping no-transform for hydration integrity. */
export async function encodePrivateDocument(request: Request, response: Response) {
  const path = new URL(request.url).pathname
  if (request.method !== 'GET' || (path !== '/app' && !path.startsWith('/app/')) ||
    response.status !== 200 || !response.body || response.headers.has('content-encoding') ||
    !response.headers.get('content-type')?.includes('text/html')) return response

  // Cloudflare can normalize Accept-Encoding; cf retains the client's value.
  const cf = (request as Request & { cf?: { clientAcceptEncoding?: string } }).cf
  const accepted = cf?.clientAcceptEncoding ?? request.headers.get('accept-encoding') ?? ''
  const encodings = new Map(accepted.toLowerCase().split(',').map(value => {
    const [name, ...parameters] = value.trim().split(';')
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='))
    return [name, quality ? Number(quality.trim().slice(2)) : 1] as const
  }))
  if (!((encodings.get('gzip') ?? encodings.get('*') ?? 0) > 0)) return response

  const headers = new Headers(response.headers)
  const started = performance.now()
  headers.set('content-encoding', 'gzip')
  headers.append('vary', 'Accept-Encoding')
  // The private document is already buffered for final authorization. Finish
  // gzip too, so the edge sends one bounded body instead of delaying its flush.
  const body = await new Response(response.body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
  headers.set('content-length', String(body.byteLength))
  headers.append('server-timing', `gzip;dur=${(performance.now() - started).toFixed(1)}`)
  const init: ResponseInit & { encodeBody: 'manual' } = {
    status: response.status, statusText: response.statusText, headers, encodeBody: 'manual',
  }
  return new Response(body, init)
}
