/** First instant of a workspace calendar date. A date is a set of instants,
 * rather than a wall-clock appointment: repeated midnight chooses its first
 * occurrence, a midnight gap begins at the first valid instant, and a skipped
 * date has the same boundary as the next date. */
export function calendarBoundary(day: string, timezone: string) {
  const parts = day.match(/^([+-]?\d{4,6})-(\d{2})-(\d{2})$/);
  if (!parts) throw new Error('Enter a valid calendar date.');
  const target = Number(parts[1]) * 10000 + Number(parts[2]) * 100 + Number(parts[3]);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', era: 'short' });
  const mark = (instant: number) => {
    const value = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const year = value.era === 'BC' ? 1 - Number(value.year) : Number(value.year);
    return year * 10000 + Number(value.month) * 100 + Number(value.day);
  };
  const noon = Date.parse(day + 'T12:00:00Z');
  let low = noon - 36 * 3600000, high = noon + 36 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (mark(middle) < target) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}
