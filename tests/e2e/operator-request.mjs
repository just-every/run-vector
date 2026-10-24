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
