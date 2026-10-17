import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchJson } from '../../../app/api-client';
import { privateReads } from '../../../app/read-lifecycle';
import { isEditableTarget } from '../../search/ui/command-helpers';
import { bulkFailuresSchema, bulkReceiptSchema } from '../../issues/ui/issue-keyboard-actions';
import { undoReceiptSchema, type UndoReceipt } from './receipt';

export function useIssueUndo() {
  const [receipt, setReceipt] = useState<UndoReceipt | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<Array<{identifier: string; reasons: string[]}>>([]);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(Date.now);
  const pending = useRef(false);
  const latest = useRef(receipt);
  latest.current = receipt;
  const undo = useCallback(async () => {
    const current = latest.current;
    if (!current || pending.current || privateReads.paused || Date.now() >= current.expiresAt) return;
    pending.current = true; setBusy(true); setHidden(false); setError(''); setFailures([]);
    try {
      const result = await fetchJson('/api/issues/undo', bulkReceiptSchema, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId: current.actionId }),
      });
      setReceipt(previous => previous?.actionId === current.actionId ? null : previous);
      if (latest.current?.actionId === current.actionId)
        setMessage(`Undid changes to ${result.changed === 1 ? current.identifiers[0] : result.changed + ' issues'}.`);
      window.dispatchEvent(new Event('vector:issues-changed'));
    } catch (cause) {
      if (latest.current?.actionId !== current.actionId) return;
      setError(cause instanceof Error ? cause.message : 'Undo could not be completed.');
      const parsed = cause instanceof ApiError ? bulkFailuresSchema.safeParse(cause.body) : null;
      if (parsed?.success) setFailures(parsed.data.failures);
      if (cause instanceof ApiError && [401, 403, 404, 409, 410].includes(cause.status))
        setReceipt(previous => previous?.actionId === current.actionId ? null : previous);
    } finally { pending.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    const receive = (event: Event) => {
      const parsed = undoReceiptSchema.safeParse((event as CustomEvent).detail);
      if (!parsed.success) return;
      latest.current = parsed.data;
      setReceipt(parsed.data); setNow(Date.now()); setHidden(false); setMessage(''); setError(''); setFailures([]);
    };
    const clear = () => { latest.current = null; setReceipt(null); setMessage(''); setError(''); setFailures([]); };
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (isEditableTarget(event.target instanceof HTMLElement ? event.target : null)) return;
      const current = latest.current;
      if (!current || Date.now() >= current.expiresAt || privateReads.paused) return;
      event.preventDefault(); void undo();
    };
    window.addEventListener('vector:issue-undo-available', receive);
    window.addEventListener('vector:auth-lost', clear);
    window.addEventListener('keydown', keydown, true);
    return () => {
      window.removeEventListener('vector:issue-undo-available', receive);
      window.removeEventListener('vector:auth-lost', clear);
      window.removeEventListener('keydown', keydown, true);
    };
  }, [undo]);
  useEffect(() => {
    if (!receipt) return;
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= receipt.expiresAt) setReceipt(previous => previous?.actionId === receipt.actionId ? null : previous);
    }, 100);
    return () => window.clearInterval(timer);
  }, [receipt]);
  return { receipt, message, error, failures, busy, hidden, undo, seconds: receipt ? Math.max(0, Math.ceil((receipt.expiresAt - now) / 1000)) : 0,
    dismiss: () => { setHidden(true); setMessage(''); setError(''); setFailures([]); } };
}
