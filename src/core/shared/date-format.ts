import { useViewerTime } from '../app/viewer-time';

/** Calendar dates keep their day; instants are first read in the viewer's zone. */
export function calendarDate(value: string | number, zone: string, now = new Date()) {
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const instant = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  const currentYear = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric' }).format(now);
  const dateZone = dateOnly ? 'UTC' : zone;
  const year = new Intl.DateTimeFormat('en', { timeZone: dateZone, year: 'numeric' }).format(instant);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: dateZone, month: 'short', day: 'numeric', ...(year !== currentYear ? { year: 'numeric' } : {}),
  }).format(instant);
}

export function useDateFormat() {
  const { effectiveTimezone: zone } = useViewerTime();
  const date = (value: string | number) => calendarDate(value, zone);
  const time = (value: string | number) => new Intl.DateTimeFormat(undefined, {
    timeZone: zone, hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
  const range = (start: string, end: string) => {
    const first = new Date(start), last = new Date(end);
    const year = (value: Date) => new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric' }).format(value);
    const thisYear = year(new Date());
    const days = new Intl.DateTimeFormat(undefined, {
      timeZone: zone, month: 'short', day: 'numeric',
      ...(year(first) !== thisYear || year(last) !== thisYear ? { year: 'numeric' } : {}),
    }).formatRange(first, last).replace(/\s*[–−]\s*/g, ' – ');
    return `${days} · ${time(start)}${time(start) === time(end) ? '' : ` – ${time(end)}`}`;
  };
  return { date, time, dateTime: (value: string | number) => `${date(value)} · ${time(value)}`, range, zone };
}
