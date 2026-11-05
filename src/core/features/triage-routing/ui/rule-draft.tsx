import { useId, useState, type FormEvent } from 'react';
import { useHydrated } from '../../../app/initial-resources';
import type { RoutingView } from './data';
import { sourceLabel, type Routing } from './use-routing';

/** The draft behind "+ Add routing rule": a name, the delivering Sentry connection and the team that receives it. */
export function useRuleDraft(routing: Routing) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetTeamId, setTargetTeamId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  // A scope with one connection starts on it; the choice stays the person's own once made.
  const source = sourceId || (routing.resource.data?.sources[0]?.id ?? '');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try {
      await routing.save(rules => [...rules, { id: crypto.randomUUID(), name: name.trim(), sourceId: source, targetTeamId }]);
      setName(''); setSourceId(''); setTargetTeamId(''); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The rule could not be added.'); }
    finally { setPending(false); }
  }
  return { open, show: () => setOpen(true), hide: () => { setOpen(false); setError(''); }, submit, pending, error,
    name, setName, source, setSourceId, targetTeamId, setTargetTeamId };
}
type Draft = ReturnType<typeof useRuleDraft>;

/** The draft's fields and its explicit Add rule, inside the scope's own form. */
export function RuleDraftFields({ draft, view }: { draft: Draft; view: RoutingView }) {
  const id = useId();
  return <>
    <div className="add-status-pair">
      <div className="field"><div className="field-head"><label htmlFor={`${id}-name`}>Rule name</label></div>
        <input id={`${id}-name`} type="text" required maxLength={120} autoComplete="off" autoFocus value={draft.name} onChange={event => draft.setName(event.target.value)} /></div>
      <div className="field"><div className="field-head"><label htmlFor={`${id}-source`}>Sentry connection</label></div>
        <select id={`${id}-source`} required value={draft.source} onChange={event => draft.setSourceId(event.target.value)}>
          {view.sources.map(source => <option key={source.id} value={source.id}>{sourceLabel(view, source.id)}</option>)}
        </select></div>
      <div className="field"><div className="field-head"><label htmlFor={`${id}-team`}>Destination team</label></div>
        <select id={`${id}-team`} required value={draft.targetTeamId} onChange={event => draft.setTargetTeamId(event.target.value)}>
          <option value="">Choose a team</option>
          {view.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select></div>
    </div>
    <div className="confirm-actions">
      <button type="submit" className="button-ink" disabled={draft.pending}>Add rule</button>
      <button type="button" className="button-text" disabled={draft.pending} onClick={draft.hide}>Cancel</button>
    </div>
    {draft.error && <p className="confirm-error" role="alert">{draft.error}</p>}
  </>;
}

/** Opens the draft in place, only when asked. */
export function AddRuleButton({ draft }: { draft: Draft }) {
  const hydrated = useHydrated();
  return <button type="button" className="link-button" disabled={!hydrated} onClick={draft.show}><span aria-hidden="true">+</span> Add routing rule</button>;
}
