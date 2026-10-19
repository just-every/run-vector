import { useViewerTime } from '../../../app/viewer-time';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useHydrated } from '../../../app/initial-resources';
import { fetchJson, useApiResource, ApiError } from '../../../app/api-client';
import { SafeMarkdown } from '../../markdown/ui/markdown';
import { issueDetailSchema, type IssueDetailData } from '../../issues/ui/data';
import './history.css';

const historySchema = z.object({ revisions: z.array(z.object({ id: z.string(), description: z.string(), actor: z.string().nullable(), createdAt: z.string(), version: z.number().nullable() })) });
const json = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

export function IssueDescription({ issue, onRefresh }: { issue: IssueDetailData; onRefresh: (issue?: IssueDetailData) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <>
    {issue.description ? <details className="detail-section issue-description" open><summary>Description</summary>
      <SafeMarkdown taskBusy={busy} onTaskChange={async task => {
        if (busy) return;
        setBusy(true); setError('');
        try {
          const updated = await fetchJson(`/api/issues/${issue.identifier}/checklist`, issueDetailSchema, json({ expectedVersion: issue.version, ...task }));
          onRefresh(updated);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'The checklist could not be saved.');
          if (cause instanceof ApiError && cause.status === 409) onRefresh();
        } finally { setBusy(false); }
      }}>{issue.description}</SafeMarkdown>
      {error && <p role="alert">{error}</p>}
    </details> : null}
    <DescriptionHistory key={issue.identifier} issue={issue} onRefresh={onRefresh} />
  </>;
}

function DescriptionHistory({ issue, onRefresh }: { issue: IssueDetailData; onRefresh: (issue?: IssueDetailData) => void }) {
  const { formatInstant } = useViewerTime();
  const hydrated = useHydrated();
  // Returning from an inspector retires its state while admitted history reads
  // finish, just like the inspector's personal-reminder reads.
  const history = useApiResource(`/api/issues/${issue.identifier}/description-history`, historySchema, undefined, {
    abortPendingOnDispose: false,
  });
  const previousVersion = useRef(issue.version);
  useEffect(() => {
    if (previousVersion.current !== issue.version) {
      previousVersion.current = issue.version;
      history.refreshAfterMutation();
    }
  }, [issue.version, history.refreshAfterMutation]);
  const revisions = history.data?.revisions ?? [];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = revisions.find(revision => revision.id === from) ?? revisions[0];
  const right = revisions.find(revision => revision.id === to) ?? revisions.at(-1);
  const option = (revision: typeof revisions[number], index: number) => `Revision ${index + 1} · ${revision.actor ?? 'Automation'} · ${formatInstant(revision.createdAt)}`;
  return <details className="secondary-section description-history"><summary>Description history{revisions.length ? ` · ${revisions.length}` : ''}</summary>
    {history.error ? <p role="alert">{history.error.message} <button onClick={history.reload}>Retry history</button></p> : null}
    {revisions.length > 0 && <>
      <div className="revision-selectors"><label>Compare from<select aria-label="Compare from revision" value={left?.id ?? ''} onChange={event => setFrom(event.target.value)}>{revisions.map((revision, index) => <option key={revision.id} value={revision.id}>{option(revision, index)}</option>)}</select></label>
      <label>Compare to<select aria-label="Compare to revision" value={right?.id ?? ''} onChange={event => setTo(event.target.value)}>{revisions.map((revision, index) => <option key={revision.id} value={revision.id}>{option(revision, index)}</option>)}</select></label></div>
      <p>Changed lines are highlighted. Restoring writes a new revision.</p>
      <div className="revision-comparison"><RevisionText title="Earlier Markdown" text={left?.description ?? ''} other={right?.description ?? ''} /><RevisionText title="Later Markdown" text={right?.description ?? ''} other={left?.description ?? ''} /></div>
      <button type="button" disabled={!hydrated || busy || !left} onClick={async () => {
        if (!left || busy) return;
        setBusy(true); setError('');
        try {
          const updated = await fetchJson(`/api/issues/${issue.identifier}/description-restore`, issueDetailSchema, json({ expectedVersion: issue.version, revisionId: left.id }));
          onRefresh(updated); history.refreshAfterMutation();
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'The description could not be restored.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Restoring…' : 'Restore earlier revision'}</button>
    </>}
    {!history.loading && !history.error && !revisions.length && <p>No description revisions.</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
function RevisionText({ title, text, other }: { title: string; text: string; other: string }) {
  const lines = text.split('\n'), comparison = other.split('\n');
  return <section><h3>{title}</h3><pre>{lines.map((line, index) => <span key={index} className={line === comparison[index] ? '' : 'revision-line-changed'}>{line || ' '}{'\n'}</span>)}</pre></section>;
}
