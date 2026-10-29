import type {MonthEvent} from './schema';
const onDay=(event:MonthEvent,day:string)=>event.firstDay<=day&&event.lastDay>=day;
export type Bar={event:MonthEvent;span:number};
export type DayLayout={lanes:(Bar|null)[];singles:MonthEvent[];more:number};
/** A multi-day event is drawn once per week row, from its first visible day across the days it covers; every other
 * event is a chip on its own day. At most `limit` rows are drawn in a day and the rest count as "+n more". */
export function layoutWeek(week:string[],events:MonthEvent[],limit=3):DayLayout[]{
 const inWeek=events.filter(e=>week.some(day=>onDay(e,day)));
 const spans=inWeek.filter(e=>e.firstDay<e.lastDay).sort((a,b)=>a.firstDay.localeCompare(b.firstDay)||b.lastDay.localeCompare(a.lastDay)||a.title.localeCompare(b.title));
 const lanes:{event:MonthEvent;from:number;to:number}[][]=[],hidden:{from:number;to:number}[]=[];
 for(const event of spans){
  const from=Math.max(0,week.findIndex(day=>day>=event.firstDay)),to=week.reduce((last,day,i)=>day<=event.lastDay?i:last,from);
  const lane=lanes.find(row=>row.every(bar=>bar.to<from||bar.from>to));
  if(lane)lane.push({event,from,to});else if(lanes.length<limit)lanes.push([{event,from,to}]);else hidden.push({from,to});
 }
 const singles=inWeek.filter(e=>e.firstDay>=e.lastDay);
 return week.map((day,i)=>{
  const room=Math.max(0,limit-lanes.length),own=singles.filter(e=>onDay(e,day)),shown=own.slice(0,room);
  return {
   lanes:lanes.map(row=>{const bar=row.find(b=>b.from===i);return bar?{event:bar.event,span:bar.to-bar.from+1}:null;}),
   singles:shown,more:own.length-shown.length+hidden.filter(h=>h.from<=i&&h.to>=i).length,
  };
 });
}
