import { useEffect, useRef } from 'react';
import { FailureLine, SavedMark } from '../../settings/ui/fields/field-feedback';
import { useAutosave } from '../../settings/ui/fields/use-autosave';

/** Rename in place: stored on blur or Enter; Escape leaves without a change. */
export function RenameInPlace({ label, value, save, onDone }: { label: string; value: string; save: (next: string) => Promise<unknown>; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const field = useAutosave({ value, label, save: next => save(next.trim()) });
  async function finish() { if (await field.commit()) onDone(); }
  return <div className="status-rename">
    <input ref={input} type="text" aria-label={label} value={field.shown} maxLength={120} required autoComplete="off"
      onChange={event => field.edit(event.target.value)} onBlur={() => void finish()}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); void finish(); }
        if (event.key === 'Escape') { event.preventDefault(); onDone(); }
      }} />
    <SavedMark state={field.state} />
    <FailureLine failed={field.failed} reason={field.reason} onRetry={field.retry} />
  </div>;
}
