import {dayAt,dayNumber} from '../calendar-view/timeline-dates';
import type {Placement} from './schema';
export {dayAt,dayNumber};
export type Zoom = 'week' | 'month' | 'quarter';
export function projectPlacement(project:{startDate:string|null;targetDate:string|null}, today:string):Placement {
  const {startDate:start,targetDate:target} = project;
  if(start && target)return {kind:'interval',start,end:target};
  if(target)return {kind:'diamond',start:target,end:target};
  if(start)return {kind:'open',start,end:start>today?start:today};
  return {kind:'unscheduled',start:null,end:null};
}
export function initiativePlacement(projects:{startDate:string|null;targetDate:string|null}[], target:string|null, today:string):Placement {
  const starts=projects.flatMap(p=>p.startDate?[p.startDate]:[]).sort(),targets=projects.flatMap(p=>p.targetDate?[p.targetDate]:[]).sort();
  if(starts.length || targets.length)return projectPlacement({startDate:starts[0]??null,targetDate:targets.at(-1)??null},today);
  return projectPlacement({startDate:null,targetDate:target},today);
}
export function shiftDate(date:string, zoom:Zoom, direction:number) {
  if(zoom==='week')return dayAt(dayNumber(date)+7*direction);
  const value=new Date(date+'T00:00:00Z'),day=value.getUTCDate();
  value.setUTCDate(1);value.setUTCMonth(value.getUTCMonth()+direction*(zoom==='quarter'?3:1));
  const last=new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth()+1,0)).getUTCDate();
  value.setUTCDate(Math.min(day,last));return value.toISOString().slice(0,10);
}
export function roadmapGeometry(placements:Placement[],today:string,zoom:Zoom) {
  const dates=[today,...placements.flatMap(p=>[p.start,p.end].filter((d):d is string=>!!d))].map(dayNumber);
  const first=Math.min(...dates)-7,last=Math.max(...dates)+14,span=Math.max(21,last-first);
  const position=(date:string)=>(dayNumber(date)-first)/span*100;
  const ticks:string[]=[];let cursor=dayAt(first);
  while(dayNumber(cursor)<=first+span && ticks.length<100){ticks.push(cursor);cursor=shiftDate(cursor,zoom,1);}
  return {first,span,position,ticks,width:Math.max(760,span*(zoom==='week'?18:zoom==='month'?6:2))};
}
