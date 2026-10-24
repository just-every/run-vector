import {calendarAuthority} from '../calendar-feeds/service';
import {readCalendarEvents} from '../calendar-feeds/events';
import {browseActor,workspaceDate} from '../issues/browse-access';
import {addDays} from '../cycle-schedule/calendar';
import {monthSchema} from './schema';
/** One event query serves capability feeds and the month calendar. The month
 * projection converts timed cycle boundaries into the workspace calendar. */
export async function readMonthCalendar(db:D1Database,actor:string,origin:string,requested?:string){
 await calendarAuthority(db,actor);const access=await browseActor(db,actor),today=workspaceDate(new Date(),access.timezone),month=monthSchema.parse(requested??today.slice(0,7));
 const events=(await readCalendarEvents(db,actor,{kind:'visible'},origin)).map(event=>({...event,firstDay:event.allDay?event.start:workspaceDate(new Date(event.start),access.timezone),lastDay:event.allDay?addDays(event.end,-1):workspaceDate(new Date(Date.parse(event.end)-1),access.timezone)})).filter(event=>event.firstDay.slice(0,7)<=month&&event.lastDay.slice(0,7)>=month);
 await calendarAuthority(db,actor);return {canEdit:access.role!=='viewer',month,today,timezone:access.timezone,events};
}
