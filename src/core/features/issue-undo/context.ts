import type { UndoReceipt } from "./schema";
const sessions = new WeakMap<D1Database, string>();
const receipts = new WeakMap<D1Database, UndoReceipt>();

/** Called once after native middleware scopes its DB to the admitted session. */
export function configureUndoSession(db: D1Database, sessionId: string) {
  sessions.set(db, sessionId);
  receipts.delete(db);
}
export function committedUndoReceipt(db: D1Database) { return receipts.get(db) ?? null; }
export function recordCommittedUndo(db: D1Database, receipt: UndoReceipt) { receipts.set(db, receipt); }
export async function undoSessionHash(db: D1Database) {
  const session = sessions.get(db);
  if (!session) return null; // Bearer integrations do not offer native member Undo.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
