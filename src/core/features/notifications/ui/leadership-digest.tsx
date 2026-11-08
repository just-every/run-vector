import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { fetchJson, useApiResource } from '../../../app/api-client';
import { leadershipPreferencesSchema } from '../../leadership-digests/schema';
/** Personal choices reuse the notification screen's existing labelled controls. */
export function LeadershipDigestControls({slackReason}:{slackReason?:string}) {
  const data=useApiResource('/api/settings/notifications/leadership-digest',leadershipPreferencesSchema);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  async function choose(channel:'email'|'slack',enabled:boolean) {
    if (!data.data || busy) return;
    setBusy(true);setError('');setSaved(false);
    try {
      const result=await fetchJson('/api/settings/notifications/leadership-digest',leadershipPreferencesSchema,
        {method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:data.data.email,slack:data.data.slack,[channel]:enabled})});
      data.publishReceipt(()=>result);setSaved(true);
    } catch (cause) {setError(cause instanceof Error?cause.message:'Unable to save leadership digest channels.');}
    finally {setBusy(false);}
  }
  return <section className="leadership-digest-controls" aria-label="Weekly leadership digest">
    <h3>Weekly leadership digest</h3>
    <p>For initiatives you own or subscribe to, receive status, date changes, new computed risks and completed milestones once each week during <Link to="/app/settings/profile">your working days and hours</Link>.</p>
    {data.data && <fieldset disabled={busy || Boolean(data.error)}><legend>Send my weekly leadership digest by</legend>
      <label><input type="checkbox" checked={data.data.email} onChange={e=>void choose('email',e.target.checked)}/>Email leadership digest</label>
      <label><input type="checkbox" checked={data.data.slack} disabled={Boolean(slackReason) && !data.data.slack} onChange={e=>void choose('slack',e.target.checked)}/>Slack direct message leadership digest</label>
    </fieldset>}
    {slackReason && <p>{slackReason}</p>}
    {busy && <p role="status">Saving leadership digest channels…</p>}
    {saved && <p role="status">Leadership digest channels saved.</p>}
    {data.data && <><h4>Leadership digest delivery updates</h4>
      {data.data.deliveries.length===0 ? <p>No failed or uncertain leadership digests.</p> : <ul>{data.data.deliveries.map(delivery=><li key={delivery.id}>
        <strong>{delivery.channel==='email'?'Email':'Slack'} leadership digest {delivery.status}</strong>
        <p>{delivery.attempts} {delivery.attempts===1?'attempt':'attempts'} · <time dateTime={delivery.updatedAt}>{delivery.updatedAt}</time></p>
        <p>{delivery.status==='uncertain'?'It will not be sent again automatically.':'The limited retries have ended. Check your delivery settings.'}</p>
      </li>)}</ul>}
    </>}
    {(error || data.error) && <p role="alert">{error || data.error?.message}</p>}
  </section>;
}
