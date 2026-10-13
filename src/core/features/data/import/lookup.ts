/** Source names and configured aliases are data, including Object prototype names. */
export function ownEntry<T>(entries:Record<string,T>|undefined,key:string):T|undefined {
 return entries&&Object.hasOwn(entries,key)?entries[key]:undefined;
}

/** The applicable qualified alias wins even when its target has just changed. */
export function referenceAliasKey(entries:Record<string,string>|undefined,value:string,team?:string):string {
 const qualified=team===undefined?undefined:team+'/'+value;
 return qualified!==undefined&&ownEntry(entries,qualified)!==undefined?qualified:value;
}
/** Exact ID/name matches precede the sole case-insensitive name match. */
export function referenceMatches<T extends {id:string;name?:unknown;email?:unknown}>(rows:T[],selected:string,assignee=false):T[] {
 const exact=rows.filter(row=>row.id===selected||row.name===selected||(assignee&&row.email===selected));
 return exact.length?exact:rows.filter(row=>typeof row.name==='string'&&row.name.toLowerCase()===selected.toLowerCase());
}
