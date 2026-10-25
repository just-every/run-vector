import { useViewerTime, viewerTimeSchema } from '../../../app/viewer-time';
import { SettingsSaveForm } from './settings-save-form';
import { TimezonePicker, timezoneName, browserTimezone } from './timezone-picker';
import './personal-time.css';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function PersonalTimePanel() {
  const clock = useViewerTime();
  return <section id="personal-time" className="personal-time-panel" aria-labelledby="personal-time-heading">
    <h2 id="personal-time-heading">Your time and working hours</h2>
    <p>Due reminders arrive at {clock.reminderTime} in {timezoneName(clock.effectiveTimezone)}. Personal reminders, snoozes and displayed timestamps use your zone. Cycle boundaries and workspace calendar days use {timezoneName(clock.workspaceTimezone)}.</p>
    <SettingsSaveForm aria-label="Your time preferences" path="/api/settings/personal-time" method="PATCH" schema={viewerTimeSchema}
      read={fields => ({timezone: fields.get('timezone') || null, workingHoursStart: fields.get('workingHoursStart'), workingHoursEnd: fields.get('workingHoursEnd'), workingDays: fields.getAll('workingDays').map(Number)})}
      onSaved={clock.publish} initialize={form => {
        if (clock.configured) return false;
        const zone = form.elements.namedItem('timezone');
        if (!(zone instanceof HTMLSelectElement)) return false;
        zone.value = browserTimezone();
        return true;
      }}>
      <TimezonePicker label="Personal timezone" value={clock.timezone ?? ''} follow={clock.workspaceTimezone} />
      <div className="personal-time-hours"><label>Working day starts<input type="time" name="workingHoursStart" required defaultValue={clock.workingHoursStart}/></label>
      <label>Working day ends<input type="time" name="workingHoursEnd" required defaultValue={clock.workingHoursEnd}/></label></div>
      <fieldset className="personal-time-days"><legend>Working days</legend>{days.map((day,index)=><label key={day}><input type="checkbox" name="workingDays" value={index+1} defaultChecked={clock.workingDays.includes(index+1)}/>{day}</label>)}</fieldset>
      <p>Email digests follow your saved timezone, working days and working hours. Due reminders keep the reminder time above. Push quiet hours are not available yet.</p>
    </SettingsSaveForm>
  </section>;
}
