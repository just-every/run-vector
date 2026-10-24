import { request } from '@playwright/test';

// Own the request pool for one operation. The local Worker closes idle sockets
// after 5 s; a fresh client never reuses one left by an earlier browser step.
// Consume the response inside run, before disposal releases its body buffers.
export async function withOperatorClient(context, run) {
  const client = await request.newContext({ storageState: await context.storageState() });
  try {
    return await run(client);
  } finally {
    await client.dispose();
  }
}

// Public native-auth helpers also need an operation-owned pool. Materialize the
// actual response before disposal so callers retain its status, headers and body.
export async function publicRequest(url, options = {}) {
  const client = await request.newContext();
  try {
    const response = await client.fetch(String(url), { maxRedirects: 0, ...options });
    const headers = new Headers();
    for (const { name, value } of await response.headersArray()) headers.append(name, value);
    const status = response.status();
    const body = await response.body();
    return new Response([204, 205, 304].includes(status) ? null : body, {
      status, statusText: response.statusText(), headers,
    });
  } finally {
    await client.dispose();
  }
}
