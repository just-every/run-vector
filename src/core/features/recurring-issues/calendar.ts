import { calendarDay, addDays } from '../cycle-schedule/calendar'
import { localTimeToInstant } from '../administration/calendar'

export { addDays }
/** Calendar weeks use the captured workspace zone, never 168-hour arithmetic.
 * Missed weeks are not backfilled: a restart considers only the current due week. */
export function dueWeek(row:{next_on:string;timezone:string},now:Date) {
  const today=calendarDay(now.toISOString(),row.timezone)
  if(row.next_on>today)return null
  const days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(row.next_on+'T12:00:00Z'))/86400000)
  const day=addDays(row.next_on,Math.floor(days/7)*7)
  return {day,at:localTimeToInstant(day+'T00:00',row.timezone),next:addDays(day,7)}
}
