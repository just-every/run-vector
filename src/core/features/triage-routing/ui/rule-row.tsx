import { useState, type DragEvent } from 'react';
import { Tooltip } from '../../../ui/tooltip';
import { ConfirmLine } from '../../settings/ui/fields/confirm-line';
import { RowMenu } from '../../settings/ui/fields/row-menu';
import { SelectField } from '../../settings/ui/fields/select-field';
import type { RoutingRule, RoutingView } from './data';
import { RenameRule } from './rename-rule';
import { sourceLabel, teamLabel, type RuleChange } from './use-routing';

export type RuleDrag = { id: string | null; set: (id: string | null) => void; drop: (target: string) => void; step: (id: string, step: -1 | 1) => void };

/** One rule: its place, a drag handle, its name over "connection → team", and a "…" with Rename, Change team, Move and Remove…. */
export function RuleRow({ rule, position, count, view, save, drag }: {
  rule: RoutingRule; position: number; count: number; view: RoutingView; save: (change: RuleChange) => Promise<unknown>; drag: RuleDrag;
}) {
  const [mode, setMode] = useState<'rename' | 'team' | 'remove' | null>(null);
  const change = (next: Partial<RoutingRule>) => save(rules => rules.map(item => item.id === rule.id ? { ...item, ...next } : item));
  const items = [
    { label: 'Rename', onSelect: () => setMode('rename') },
    { label: 'Change team', onSelect: () => setMode('team') },
    ...(position > 0 ? [{ label: 'Move up', onSelect: () => drag.step(rule.id, -1) }] : []),
    ...(position < count - 1 ? [{ label: 'Move down', onSelect: () => drag.step(rule.id, 1) }] : []),
    { label: 'Remove…', onSelect: () => setMode('remove') },
  ];
  const dragStart = (event: DragEvent) => { event.dataTransfer.setData('text/plain', rule.id); event.dataTransfer.effectAllowed = 'move'; drag.set(rule.id); };
  return <li className="status-row row-hover" data-dragging={drag.id === rule.id || undefined} data-mode={mode ?? undefined}
    onDragOver={event => { if (drag.id && drag.id !== rule.id) event.preventDefault(); }}
    onDrop={event => { event.preventDefault(); drag.drop(rule.id); }}>
    <div className="status-line">
      <Tooltip label="Drag to reorder">
        <button type="button" className="status-handle" draggable aria-label={`Reorder ${rule.name}`} onDragStart={dragStart} onDragEnd={() => drag.set(null)}
          onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); drag.step(rule.id, event.key === 'ArrowUp' ? -1 : 1); } }}>
          <span aria-hidden="true">⋮⋮</span>
        </button>
      </Tooltip>
      <span className="routing-position" aria-hidden="true">{position + 1}</span>
      {mode === 'rename'
        ? <RenameRule rule={rule} change={change} onDone={() => setMode(null)} />
        : <div className="row-main"><span className="status-name">{rule.name}</span>
          <span className="row-meta">{sourceLabel(view, rule.sourceId)} → {teamLabel(view, rule.targetTeamId)}</span></div>}
      <RowMenu name={rule.name} items={items} />
    </div>
    {mode === 'team' && <div className="routing-retarget">
      <SelectField label={`Team for ${rule.name}`} value={rule.targetTeamId}
        options={[...(view.teams.some(team => team.id === rule.targetTeamId) ? [] : [{ value: rule.targetTeamId, label: teamLabel(view, rule.targetTeamId) }]),
          ...view.teams.map(team => ({ value: team.id, label: team.name }))]}
        save={next => change({ targetTeamId: next })} />
      <button type="button" className="button-text" onClick={() => setMode(null)}>Done</button>
    </div>}
    {mode === 'remove' && <ConfirmLine question={`Remove ${rule.name}?`} detail="New Sentry issues stop following this rule. Issues it already placed keep their team."
      confirm="Remove rule" danger onConfirm={() => save(rules => rules.filter(item => item.id !== rule.id))} onCancel={() => setMode(null)} />}
  </li>;
}
