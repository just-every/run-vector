import { useEffect, useRef } from 'react';
import { FailureLine, SavedMark } from '../../settings/ui/fields/field-feedback';
import { Refusal, useAutosave } from '../../settings/ui/fields/use-autosave';
import type { RoutingRule } from './data';

/** Rename in place: stored on blur or Enter; Escape leaves without a change. */
export function RenameRule({ rule, change, onDone }: { rule: RoutingRule; change: (next: Partial<RoutingRule>) => Promise<unknown>; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const field = useAutosave({
    value: rule.name, label: `Rule name ${rule.name}`,
    save: async next => { if (!next.trim()) throw new Refusal('Enter a rule name.'); await change({ name: next.trim() }); },
  });
  async function finish() { if (await field.commit()) onDone(); }
  return <div className="status-rename">
    <input ref={input} type="text" aria-label={`Rule name ${rule.name}`} value={field.shown} maxLength={120} required autoComplete="off"
      onChange={event => field.edit(event.target.value)} onBlur={() => void finish()}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); void finish(); }
        if (event.key === 'Escape') { event.preventDefault(); onDone(); }
      }} />
    <SavedMark state={field.state} />
    <FailureLine failed={field.failed} reason={field.reason} onRetry={field.retry} />
  </div>;
}
