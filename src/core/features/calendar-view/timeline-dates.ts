import type {TimelineIssue} from './timeline-schema';

const milliseconds=86400000;
export const dayNumber=(day:string)=>Date.parse(day+'T12:00:00Z')/milliseconds;
export const dayAt=(day:number)=>new Date(day*milliseconds).toISOString().slice(0,10);
export function timelineGeometry(issues:TimelineIssue[],today:string){
  const dates=[today,...issues.flatMap(issue=>[issue.startDate,issue.dueDate].filter((date):date is string=>!!date))].map(dayNumber);
  const first=Math.min(...dates)-3,last=Math.max(...dates)+3,span=last-first;
  const position=(date:string)=>(dayNumber(date)-first)/span*100;
  return {first,last,span,position,ticks:Array.from({length:7},(_,i)=>dayAt(Math.round(first+span*i/6)))};
}
export function issueInterval(issue:TimelineIssue,today:string){
  const start=issue.startDate??issue.dueDate!,end=issue.dueDate??today;
  return {start,end,first:start<end?start:end,last:start<end?end:start,kind:issue.startDate?(issue.dueDate?'interval':'open'):'diamond'};
}
