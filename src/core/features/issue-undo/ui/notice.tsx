import { useIssueUndo } from './use-issue-undo';
import './notice.css';

export function IssueUndoNotice() {
  const state = useIssueUndo();
  if (state.hidden || (!state.receipt && !state.message && !state.error)) return null;
  return <section className="issue-undo-notice" aria-label="Issue Undo" aria-live="polite">
    <div>
      {state.receipt && <><strong>Changes saved to {state.receipt.identifiers.length === 1 ? state.receipt.identifiers[0] : state.receipt.identifiers.length + ' issues'}.</strong><p aria-live="off">Undo for {state.seconds} seconds · ⌘/Ctrl Z</p></>}
      {state.message && <p role="status">{state.message}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {state.failures.length > 0 && <ul>{state.failures.map(row => <li key={row.identifier}><strong>{row.identifier}</strong>: {row.reasons.join('; ')}</li>)}</ul>}
    </div>
    <div className="issue-undo-actions">
      {state.receipt && <button type="button" disabled={state.busy || state.seconds === 0} onClick={() => void state.undo()}>{state.busy ? 'Undoing…' : 'Undo'}</button>}
      <button type="button" disabled={state.busy} onClick={state.dismiss} aria-label="Dismiss Undo notice">Dismiss</button>
    </div>
  </section>;
}
