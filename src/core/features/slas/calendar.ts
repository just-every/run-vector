import type { SlaInput } from './schema';
/** Count real elapsed time inside workspace business hours. Ordinary UTC hours
 * are aggregated; a DST transition or local midnight is inspected by minute. */
export function businessMinutes(from:string,to:string,rule:SlaInput,timezone:string) {
  let start=Date.parse(from),end=Date.parse(to),total=0;
  if(end<=start)return 0;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',weekday:'short'});
  const days:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
  const local=(ms:number)=>Object.fromEntries(formatter.formatToParts(ms).map(p=>[p.type,p.value]));
  const minute=(text:string)=>Number(text.slice(0,2))*60+Number(text.slice(3));
  const lower=minute(rule.startsAt),upper=minute(rule.endsAt);
  while(start<end){
    let next=Math.min(end,Math.floor(start/3600000)*3600000+3600000);
    const p=local(start),q=local(next-1);
    const wall=Number(p.hour)*60+Number(p.minute)+Number(p.second)/60+(start%1000)/60000;
    const wallEnd=Number(q.hour)*60+Number(q.minute)+Number(q.second)/60+((next-1)%1000)/60000;
    const linear=p.year===q.year&&p.month===q.month&&p.day===q.day&&Math.abs((wallEnd-wall)*60000-(next-start-1))<1;
    if(linear){if(rule.workingDays.includes(days[p.weekday]))total+=Math.max(0,Math.min(wall+(next-start)/60000,upper)-Math.max(wall,lower));}
    else{next=Math.min(end,Math.floor(start/60000)*60000+60000);if(rule.workingDays.includes(days[p.weekday])&&wall>=lower&&wall<upper)total+=(next-start)/60000;}
    start=next;
  }
  return Math.round(total*1000000)/1000000;
}
