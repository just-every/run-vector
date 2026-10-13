type Evidence={sourceId:string|null;sourceRecordId:string|null;summary:string;link:string|null;measurements:unknown;assertions:unknown;customerReports:unknown};
export type EvidenceChange={field:string;previous:unknown;current:unknown};
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}':JSON.stringify(value);
function fields(value:Evidence){
 const result:Record<string,unknown>={summary:value.summary,link:value.link,customerReports:value.customerReports};
 for(const kind of ['measurements','assertions'] as const)if(value[kind]&&typeof value[kind]==='object')for(const [key,entry] of Object.entries(value[kind]))result[kind+'.'+key]=entry;
 return result;
}
export function evidenceChanges(current:Evidence,previous:Evidence|undefined):EvidenceChange[]{
 if(!previous)return [];const before=fields(previous),after=fields(current);
 return [...new Set([...Object.keys(before),...Object.keys(after)])].sort().filter(field=>canonical(before[field]??null)!==canonical(after[field]??null)).map(field=>({field,previous:before[field]??null,current:after[field]??null}));
}
