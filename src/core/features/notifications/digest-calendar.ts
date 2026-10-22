import { reminderCalendar } from '../due-reminders/calendar';
import { localTimeToInstant } from '../administration/calendar';
export type DigestClock = {timezone: string; workingHoursStart: string; workingHoursEnd: string; workingDays: number[]};
/** Local slots deliberately omit UTC offset: a repeated DST hour cannot repeat a slot. */
export function digestCalendar(now: Date, clock: DigestClock, cadence: 'hourly'|'daily') {
  const local = reminderCalendar(now,clock.timezone);
  const weekday = new Date(local.date+'T12:00:00Z').getUTCDay() || 7;
  if (!clock.workingDays.includes(weekday) || local.time < clock.workingHoursStart || local.time >= clock.workingHoursEnd) return null;
  if (cadence === 'daily') return local.date;
  const minutes = (time: string) => Number(time.slice(0,2))*60+Number(time.slice(3));
  const slot = minutes(clock.workingHoursStart)+60*Math.floor((minutes(local.time)-minutes(clock.workingHoursStart))/60);
  return local.date+'T'+String(Math.floor(slot/60)).padStart(2,'0')+':'+String(slot%60).padStart(2,'0');
}

/** Queued events after a slot's start belong to a later digest, even on a late tick.
 * The interactive clock utility deliberately rejects ambiguous/missing minutes.
 * Schedules instead choose the first occurrence, or the first minute after a gap. */
export function digestSlotCutoff(slot: string, clock: DigestClock, cadence: 'hourly'|'daily') {
  const local = cadence === 'daily' ? slot+'T'+clock.workingHoursStart : slot;
  try { return localTimeToInstant(local,clock.timezone); }
  catch (error) {
    const naive = Date.parse(local+':00.000Z');
    const formatter = new Intl.DateTimeFormat('en-CA', {timeZone: clock.timezone,
      year: 'numeric',month: '2-digit',day: '2-digit',hour: '2-digit',minute: '2-digit',second: '2-digit',hourCycle: 'h23'});
    const wall = (instant: number) => {
      const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type,p.value]));
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
    };
    const offsets = new Set<number>();
    for (let h=-48;h<=48;h+=6) {
      const probe = naive+h*3_600_000;
      offsets.add(Date.parse(wall(probe)+'Z')-probe);
    }
    const candidates = [...offsets].map(offset => naive-offset).sort((a,b) => a-b);
    const matches = candidates.filter(instant => wall(instant)===local+':00');
    if (matches.length) return new Date(matches[0]).toISOString();
    // A forward transition can erase the selected minute. Search only the offset
    // transition interval to locate its first actually observed eligible minute.
    for (let instant=candidates[0];instant<=candidates[candidates.length-1];instant+=60_000) {
      const rendered = wall(instant);
      if (rendered.slice(0,10)===local.slice(0,10) && rendered>=local+':00') return new Date(instant).toISOString();
    }
    throw error;
  }
}
