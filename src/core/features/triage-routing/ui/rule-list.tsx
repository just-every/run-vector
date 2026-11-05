import { useState, type ReactNode } from 'react';
import { Disclosure } from '../../settings/ui/fields/disclosure';
import { FailureLine, SavedMark } from '../../settings/ui/fields/field-feedback';
import { useAutosave } from '../../settings/ui/fields/use-autosave';
import { RuleRow } from './rule-row';
import type { Routing } from './use-routing';
import '../../settings/ui/teams/teams.css';
import './routing.css';

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * One scope's ordered rules: the first rule whose Sentry connection matches places a new issue. A handle (drag or
 * arrow keys) or the row's "…" reorders, and every change stores at once against the saved revision.
 */
export function RoutingRules({ routing, label, intro, empty, children }: {
  routing: Routing; label: string; intro: string; empty: string; children: ReactNode;
}) {
  const { resource, save } = routing;
  const view = resource.data;
  const [dragging, setDragging] = useState<string | null>(null);
  const order = useAutosave<string[]>({
    value: view?.rules.map(rule => rule.id) ?? [], same: sameOrder, label: `${label} order`,
    save: ids => save(rules => [...ids.flatMap(id => rules.filter(rule => rule.id === id)), ...rules.filter(rule => !ids.includes(rule.id))]),
  });
  const rank = (id: string) => { const index = order.shown.indexOf(id); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const rules = view ? [...view.rules].sort((a, b) => rank(a.id) - rank(b.id)) : [];
  const place = (moved: string, index: number) => {
    const ids = rules.map(rule => rule.id).filter(id => id !== moved);
    if (index < 0 || index > ids.length) return;
    ids.splice(index, 0, moved);
    void order.commit(ids);
  };
  const drag = {
    id: dragging, set: setDragging,
    drop: (target: string) => { if (dragging && dragging !== target) place(dragging, rules.findIndex(rule => rule.id === target)); setDragging(null); },
    step: (id: string, step: -1 | 1) => place(id, rules.findIndex(rule => rule.id === id) + step),
  };
  return <section className="team-block routing-rules" aria-label={label}>
    <div className="routing-heading"><h2 className="group-heading">Intake routing</h2><SavedMark state={order.state} /></div>
    <p className="field-hint">{intro}</p>
    {resource.loading && !view && <p role="status">Loading routing rules…</p>}
    {resource.error && !view && <p role="alert">{resource.error.message}{' '}
      <button type="button" className="field-retry" onClick={resource.reload}>Retry</button></p>}
    {view && view.version > 0 && <p className="row-meta">Revision {view.version}{view.configuredByName ? ` · saved by ${view.configuredByName}` : ''}</p>}
    {rules.length > 0 && view && <ol className="status-rows" aria-label={`${label} rules in order`}>
      {rules.map((rule, index) => <RuleRow key={rule.id} rule={rule} position={index} count={rules.length} view={view} save={save} drag={drag} />)}
    </ol>}
    <FailureLine failed={order.failed} reason={order.reason} onRetry={order.retry} />
    {view && (view.sources.length === 0 && view.rules.length === 0 ? <p className="field-hint">{empty}</p> : children)}
    <Disclosure title="How this works">
      <p>Workspace rules run before a team’s own rules. Within each list the first rule for the delivering Sentry connection places a new issue in its team’s Intake, and the issue shows that rule and its revision.</p>
      <p>Issues that already exist stay where they are, and no rule declines or deletes. If a rule’s team is archived or no longer open to the person who saved it, the delivery is refused rather than sent elsewhere.</p>
    </Disclosure>
  </section>;
}
