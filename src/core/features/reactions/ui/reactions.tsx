import { useRef, useState } from 'react';
import { Tooltip } from '../../../ui/tooltip';
import { useReactions } from './context';
import './reactions.css';

const choices = [['👍', 'Thumbs up'], ['❤️', 'Heart'], ['🎉', 'Celebrate'], ['😄', 'Laugh'], ['👀', 'Eyes'], ['🚀', 'Rocket']];
export function Reactions({ subjectId, label }: { subjectId: string; label: string }) {
  const state = useReactions(), [open, setOpen] = useState(false), [emoji, setEmoji] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const reactions = state.data?.reactions.filter(reaction => reaction.subjectId === subjectId) ?? [];
  async function add(value: string) {
    if (await state.change(subjectId, value, true)) { setOpen(false); setEmoji(''); trigger.current?.focus(); }
  }
  return <section className="issue-reactions" aria-label={`Reactions for ${label}`} aria-busy={state.busy}>
    <div className="reaction-list">
      {reactions.map(reaction => <Tooltip key={reaction.emoji} label={reaction.people.map(person => person.name).join(', ')}>
        <button type="button" className="reaction-badge" aria-label={`${reaction.emoji} reaction, ${reaction.count}`}
          aria-pressed={reaction.reacted} aria-disabled={!state.data?.canReact} disabled={state.busy || !state.ready}
          onClick={() => { if (state.data?.canReact) void state.change(subjectId, reaction.emoji, !reaction.reacted); }}>
          <span aria-hidden="true">{reaction.emoji}</span><span>{reaction.count}</span>
        </button>
      </Tooltip>)}
      {state.data?.canReact && <Tooltip label="Add reaction"><button ref={trigger} type="button" className="reaction-add"
        aria-label={`Add reaction to ${label}`} aria-expanded={open} disabled={state.busy || !state.ready}
        onClick={() => setOpen(!open)}><span aria-hidden="true">☺ +</span></button></Tooltip>}
    </div>
    {open && <div className="reaction-picker" role="group" aria-label="Choose an emoji" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
      <div className="reaction-choices">{choices.map(([value, name]) => <Tooltip key={value} label={name}>
        <button type="button" aria-label={name} disabled={state.busy} onClick={() => void add(value)}>{value}</button>
      </Tooltip>)}</div>
      <form onSubmit={event => { event.preventDefault(); void add(emoji); }}>
        <label>Other emoji<input name="emoji" value={emoji} onChange={event => setEmoji(event.target.value)} maxLength={64} autoComplete="off" /></label>
        <button type="submit" disabled={state.busy || !emoji}>Add emoji</button>
      </form>
    </div>}
    {state.error && <p role="alert">{state.error} <button type="button" onClick={state.retry}>Refresh reactions</button></p>}
  </section>;
}
