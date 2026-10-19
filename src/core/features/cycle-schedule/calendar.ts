import { localTimeToInstant } from "../administration/calendar";
export function calendarDay(at: string, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function addDays(day: string, days: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function nextInterval(
  after: string,
  timezone: string,
  weekday: number,
  weeks: number,
) {
  let day = calendarDay(after, timezone);
  day = addDays(
    day,
    (weekday - new Date(day + "T12:00:00Z").getUTCDay() + 7) % 7,
  );
  let startsAt = localTimeToInstant(day + "T00:00", timezone);
  if (startsAt < after) {
    day = addDays(day, 7);
    startsAt = localTimeToInstant(day + "T00:00", timezone);
  }
  return {
    startsAt,
    endsAt: localTimeToInstant(addDays(day, weeks * 7) + "T00:00", timezone),
  };
}
export function afterCooldown(end: string, timezone: string, weeks: number) {
  if (weeks === 0) return end;
  const clock = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(end))
      .map((part) => [part.type, part.value]),
  );
  const minute = localTimeToInstant(
    addDays(calendarDay(end, timezone), weeks * 7) +
      `T${clock.hour}:${clock.minute}`,
    timezone,
  );
  const original = new Date(end);
  return new Date(
    Date.parse(minute) +
      original.getUTCSeconds() * 1000 +
      original.getUTCMilliseconds(),
  ).toISOString();
}
