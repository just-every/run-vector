import { z } from 'zod';

export const refreshBatchSchema = z.object({ resources: z.array(z.object({
  path: z.string(), status: z.number(), body: z.unknown(),
})) });
type Receipt = z.output<typeof refreshBatchSchema>['resources'][number];
type Pending = { path: string; resolve: (receipt: Receipt) => void; reject: (cause: unknown) => void };

/** Only background refreshes join a batch. Explicit retries and mutation reads
 * retain their own fresh transport and their existing drain/sequence guards. */
export function createRefreshBatch(read: (url: string) => Promise<z.output<typeof refreshBatchSchema>>) {
  let queue: Pending[] = [];
  return (path: string) => new Promise<Receipt>((resolve, reject) => {
    queue.push({ path, resolve, reject });
    if (queue.length !== 1) return;
    queueMicrotask(async () => {
      const pending = queue;
      queue = [];
      const query = new URLSearchParams();
      for (const path of new Set(pending.map(item => item.path))) query.append('read', path);
      try {
        const { resources } = await read('/api/refresh?' + query);
        for (const item of pending) {
          const receipt = resources.find(resource => resource.path === item.path);
          if (receipt) item.resolve(receipt);
          else item.reject(new Error('Changes could not be refreshed.'));
        }
      } catch (cause) { for (const item of pending) item.reject(cause); }
    });
  });
}
