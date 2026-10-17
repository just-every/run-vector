import { z } from 'zod';

export const undoReceiptSchema = z.object({
  actionId: z.string(), expiresAt: z.number(), identifiers: z.array(z.string()),
});
export type UndoReceipt = z.output<typeof undoReceiptSchema>;

export function receiveUndoReceipt(response: Response) {
  const value = response.headers.get('x-vector-undo');
  if (!value || typeof window === 'undefined') return;
  const parsed = undoReceiptSchema.safeParse(JSON.parse(value));
  if (parsed.success)
    window.dispatchEvent(new CustomEvent('vector:issue-undo-available', { detail: parsed.data }));
}
