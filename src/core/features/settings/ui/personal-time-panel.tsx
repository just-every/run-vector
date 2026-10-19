import { useState, type FormEvent } from 'react';
import { useViewerTime } from '../../../app/viewer-time';
import { fetchJson } from '../../../app/api-client';
import { settingsSchema } from '../schema';
import './personal-time.css';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function PersonalTimePanel() {
  const clock = useViewerTime();
  const [draft, setDraft] = useState<null | {timezone:string;workingHoursStart:string;workingHoursEnd:string;workingDays:number[]}>(null);
  const values = draft ?? {...clock, timezone: clock.timezone ?? ''};
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const edit = (change: Partial<typeof values>) => setDraft({...values,...change});
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const updated = await fetchJson('/api/settings/personal-time', settingsSchema, {
        method: 'PATCH', headers: {'content-type':'application/json'},
        body: JSON.stringify({timezone: values.timezone || null, workingHoursStart: values.workingHoursStart,
          workingHoursEnd: values.workingHoursEnd, workingDays: values.workingDays}),
      });
      clock.publish({...updated.personalTime, workspaceTimezone:updated.workspace.timezone, reminderTime:updated.workspace.reminderTime});
      setDraft(null); setMessage('Your time preferences are saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Your time preferences could not be saved.'); }
    finally { setBusy(false); }
  }
  return <section id="personal-time" className="personal-time-panel" aria-labelledby="personal-time-heading">
    <h2 id="personal-time-heading">Your time and working hours</h2>
    <p>Due reminders arrive at {clock.reminderTime} in {clock.effectiveTimezone}. Personal reminders, snoozes and displayed timestamps use your zone. Cycle boundaries and workspace calendar days use {clock.workspaceTimezone}.</p>
    <form onSubmit={save} aria-label="Your time preferences"><fieldset disabled={busy}>
      <label>Personal IANA timezone<input value={values.timezone} placeholder={`Follow workspace (${clock.workspaceTimezone})`} maxLength={100} onChange={event=>edit({timezone:event.target.value})} aria-describedby="personal-zone-help" /></label>
      <p id="personal-zone-help">Leave blank to follow the workspace. For example, America/Los_Angeles.</p>
      <div className="personal-time-hours"><label>Working day starts<input type="time" required value={values.workingHoursStart} onChange={event=>edit({workingHoursStart:event.target.value})}/></label>
      <label>Working day ends<input type="time" required value={values.workingHoursEnd} onChange={event=>edit({workingHoursEnd:event.target.value})}/></label></div>
      <fieldset className="personal-time-days"><legend>Working days</legend>{days.map((day,index)=><label key={day}><input type="checkbox" checked={values.workingDays.includes(index+1)} onChange={event=>edit({workingDays:event.target.checked?[...values.workingDays,index+1]:values.workingDays.filter(value=>value!==index+1)})}/>{day}</label>)}</fieldset>
      <p>Working hours are saved for your account. Due reminders keep the reminder time above. Email digests and push quiet hours are not available yet.</p>
      <button type="submit">{busy?'Saving…':'Save your time preferences'}</button>
    </fieldset></form>{message&&<p role="status">{message}</p>}
  </section>;
}
