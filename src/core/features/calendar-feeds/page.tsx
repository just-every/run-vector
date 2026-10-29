import {MonthCalendar} from '../calendar-view/page';
import {IssueTimeline} from '../calendar-view/timeline';
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { fetchJson, useApiResource } from "../../app/api-client";
import { feedListSchema, feedReceiptSchema } from "./schema";
import "../insights/insights.css";
import "../settings/ui/settings.css";
const revokedSchema = z.object({ revoked: z.literal(true) });
export function CalendarPage() {
  const view=useSearch({strict:false}).view==='timeline'?'timeline':'month',navigate=useNavigate();
  const setView=(next:'month'|'timeline')=>void navigate({to:'/app/calendar',search:next==='timeline'?{view:next}:{}});
  const data = useApiResource("/api/calendar/feeds", feedListSchema);
  const [team, setTeam] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function create() {
    if (busy) return;
    setBusy(true); setError(""); setUrl(""); setMessage("");
    try {
      const receipt = await fetchJson("/api/calendar/feeds", feedReceiptSchema, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team || null }) });
      setUrl(receipt.url); data.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The feed could not be created."); }
    finally { setBusy(false); }
  }
  async function change(id: string, version: number, rotate: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setUrl(""); setMessage("");
    try {
      const path = "/api/calendar/feeds/" + id + (rotate ? "/rotate" : "");
      const init = { method: rotate ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: version }) };
      if (rotate) setUrl((await fetchJson(path, feedReceiptSchema, init)).url);
      else { await fetchJson(path, revokedSchema, init); setMessage("Feed revoked. Its old URL no longer works."); }
      data.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The feed could not be changed."); data.reload(); }
    finally { setBusy(false); }
  }
  return <main className="settings-page insights-page calendar-page" aria-labelledby="calendar-title" data-calendar-ready={data.data && !data.loading && !data.error ? "true" : "false"}>
    <header><p className="insights-eyebrow">Workspace planning</p><h1 id="calendar-title">Calendar</h1><p>Keep due dates, cycles and milestones in your calendar.</p></header>
    <section className="insights-card" aria-label="Calendar views">
      <nav className="calendar-view-modes" aria-label="Calendar view"><button aria-pressed={view==='month'} onClick={()=>setView('month')}>Month calendar</button><button aria-pressed={view==='timeline'} onClick={()=>setView('timeline')}>Timeline</button></nav>
      {view==='month'?<MonthCalendar />:<IssueTimeline />}
    </section>
    {data.error && <p role="alert">{data.error.message} <button onClick={data.reload}>Retry feeds</button></p>}
    {!data.data && !data.error && <p role="status">Loading calendar feeds…</p>}
    {data.data && !data.error && <>
      <section className="insights-card" aria-label="Create calendar feed">
        <h2>Private calendar feeds</h2><p>Subscribe in Google Calendar, Outlook or Apple Calendar using a feed URL. Anyone holding the URL can read its events. Keep it private.</p>
        <p>Your feed includes assigned issues, cycles for your teams, milestones for projects you lead or have assigned work in, and releases for your teams or the workspace that you can currently read. A team feed includes that team’s due issues, cycles, releases and milestones from its contributing projects.</p>
        <div className="insights-controls"><label>Feed scope<select aria-label="Feed scope" value={team} onChange={e => setTeam(e.target.value)} disabled={busy}>
          <option value="">My calendar</option>{data.data.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label></div>
        <button onClick={() => void create()} disabled={busy}>Create feed</button>
        <p className="insights-note">The URL is shown once. Rotating or revoking stops the old URL immediately. Calendar apps choose when to refresh and may retain events they already downloaded.</p>
      </section>
      {url && <section className="insights-card" aria-label="New feed URL">
        <h2>Save your feed URL</h2><p>Copy this URL into your calendar app’s subscription settings before closing.</p>
        <div className="insights-controls"><label>New feed URL<input aria-label="New feed URL" value={url} readOnly onFocus={e => e.currentTarget.select()} /></label></div>
        <button onClick={async () => {
          try { await navigator.clipboard.writeText(url); setMessage("Feed URL copied."); }
          catch { setError("Copy was unavailable. Select the URL and copy it using your keyboard."); }
        }}>Copy URL</button>{" "}
        <button onClick={() => setUrl("")}>I saved it; close</button>
      </section>}
      {busy && <p role="status">Saving feed…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <section className="insights-card" aria-label="Calendar feeds">
        <h2>Your feeds</h2>
        {!data.data.feeds.length && <p>No feeds yet.</p>}
        {data.data.feeds.map(feed => <article className="calendar-feed-record" key={feed.id} data-feed-id={feed.id}>
          <h3>{feed.teamName ?? "My calendar"}</h3><p>{feed.revokedAt ? "Revoked" : "Active"} · Created {feed.createdAt.slice(0, 10)}</p>
          {feed.canRotate && <button onClick={() => void change(feed.id, feed.version, true)} disabled={busy}>Rotate URL</button>}{" "}
          {feed.canRevoke && <button onClick={() => void change(feed.id, feed.version, false)} disabled={busy}>Revoke feed</button>}
        </article>)}
      </section>
      <p className="insights-note">Feeds contain event titles and links, never descriptions or comments. Feed credentials are excluded from archives: after restoring, create new feeds.</p>
    </>}
  </main>;
}
