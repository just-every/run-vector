import { useState, type FormEvent } from 'react';
import { useApiResource } from '../../../app/api-client';
import { useViewerTime } from '../../../app/viewer-time';
import { actorKinds, auditSchema, auditSearch, type AuditQuery } from '../schema';
import '../../settings/ui/settings.css';
import './audit.css';

type Filters = Partial<Record<keyof AuditQuery, string>>;
export function AuditPanel() {
  const { formatInstant } = useViewerTime();
  const [draft, setDraft] = useState<Filters>({});
  const [filters, setFilters] = useState<Filters>({});
  const resource = useApiResource('/api/settings/audit?' + auditSearch(filters), auditSchema);
  const update = (key: keyof AuditQuery, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft, from: draft.from ? new Date(draft.from).toISOString() : '', to: draft.to ? new Date(draft.to).toISOString() : '' });
  };
  const entries = resource.data?.entries;
  return <section id="audit" className="audit-panel" aria-labelledby="audit-heading">
    <div className="audit-heading"><div><h2 id="audit-heading">Audit log</h2><p>Workspace activity, retained with opaque subject references after deletion.</p></div>
      {resource.data && <a className="audit-export" href={'/api/settings/audit.csv?' + auditSearch({ ...filters, through: String(resource.data.through) })}>Export filtered CSV</a>}
    </div>
    <form className="audit-filters" onSubmit={apply}>
      <label>Actor reference<input name="actor" placeholder="person:… or auth:…" value={draft.actor ?? ''} onChange={e => update('actor', e.target.value)} /></label>
      <label>Actor kind<select name="kind" value={draft.kind ?? ''} onChange={e => update('kind', e.target.value)}><option value="">All actor kinds</option>{actorKinds.map(kind => <option key={kind} value={kind}>{kind === 'unknown' ? 'Unknown (historical)' : kind}</option>)}</select></label>
      <label>Action kind<input name="action" placeholder="operator.role_changed" value={draft.action ?? ''} onChange={e => update('action', e.target.value)} /></label>
      <label>Subject reference<input name="subject" value={draft.subject ?? ''} onChange={e => update('subject', e.target.value)} /></label>
      <label>From (your local time)<input name="from" type="datetime-local" value={draft.from ?? ''} onChange={e => update('from', e.target.value)} /></label>
      <label>To (your local time)<input name="to" type="datetime-local" value={draft.to ?? ''} min={draft.from || undefined} onChange={e => update('to', e.target.value)} /></label>
      <div className="audit-filter-actions"><button type="submit">Apply filters</button><button type="button" onClick={() => { setDraft({}); setFilters({}); resource.reload(); }}>Clear filters</button><button type="button" onClick={resource.reload}>Refresh</button></div>
    </form>
    {resource.loading && <p role="status">Loading audit log…</p>}
    {resource.error && <p role="alert">{resource.error.message} <button type="button" onClick={resource.reload}>Retry</button></p>}
    {entries && <><p role="status">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
      {entries.length ? <div className="audit-table-scroll"><table><thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Subject reference</th></tr></thead>
        <tbody>{entries.map(entry => <tr key={entry.id}><td data-label="Time"><time dateTime={entry.at}>{formatInstant(entry.at)}</time></td>
          <td data-label="Actor"><div className="audit-value">{entry.actorName && <span>{entry.actorName}<br /></span>}<small>{entry.actorKind}</small><br /><code>{entry.actorRef}</code></div></td><td data-label="Action"><span>{entry.action}</span></td><td data-label="Subject"><code>{entry.subjectRef}</code></td></tr>)}</tbody></table></div> : <p>No audit entries match these filters.</p>}
    </>}
  </section>;
}

export function AuditPage() {
  return <main className="settings-page"><header><p className="settings-eyebrow">Workspace</p><h1>Audit log</h1><a href="/app/settings">Back to Settings</a></header><AuditPanel /></main>;
}
