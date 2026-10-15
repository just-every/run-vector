import { Buffer } from 'node:buffer';
import type { D1Database,D1Statement } from '../../../../../vendor/base/import-kit/src/d1/index';

/** D1 limits one call to 32 MiB on the wire, and the runtime sends a string that
 * holds any character above U+00FF as two bytes per character. One em dash in an
 * import file therefore doubled the retained plan and failed a 2,000-row apply at
 * about 1,700 rows. The kit passes its large values as JSON text read with
 * json_each(?), where \uXXXX means the same character, so escaping those
 * characters keeps the text one-byte on the wire and stores the identical bytes. */
const wide=/[^\u0000-ÿ]/;
const unit=/[^\u0000-ÿ]/g;
const escape=(text:string)=>text.replace(unit,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));

/** Placeholder positions that are the direct argument of json_each(?). */
function jsonPositions(sql:string):Set<number> {
  const positions=new Set<number>();
  let index=0;
  for(let at=sql.indexOf('?');at>=0;at=sql.indexOf('?',at+1),index++)
    if(/json_each\(\s*$/i.test(sql.slice(Math.max(0,at-24),at)))positions.add(index);
  return positions;
}
export function wireValues(sql:string,values:unknown[]):unknown[] {
  if(!values.some(value=>typeof value==='string'&&wide.test(value)))return values;
  const positions=jsonPositions(sql);
  return values.map((value,index)=>{
    if(!positions.has(index)||typeof value!=='string'||!wide.test(value))return value;
    const escaped=escape(value);
    return escaped.length<value.length*2&&Buffer.byteLength(escaped)<=2_000_000?escaped:value;
  });
}

/** Every batch publication reloads the whole retained plan in one SELECT. The
 * result travels as one two-byte call when any chunk holds a character above
 * U+00FF, which passed 32 MiB at about 2,000 rows. The chunks are immutable
 * once created, so reading them in a few pages returns the same rows. */
const planRead=/^SELECT \* FROM ik_d1_plan_chunks WHERE job_id IN \(SELECT value FROM json_each\(\?\)\).* ORDER BY job_id,ordinal$/;
const planPage=3;
async function pagedPlanRead(sql:string,values:unknown[],prepare:(sql:string)=>D1Statement) {
  const results:Record<string,unknown>[]=[];
  for(let offset=0;;offset+=planPage){
    const page=await prepare(`${sql} LIMIT ${planPage} OFFSET ${offset}`).bind(...values).all();
    results.push(...page.results);
    if(page.results.length<planPage)return {results};
  }
}

type Wired=D1Statement&{native:D1Statement};
function wrap(native:D1Statement,sql:string,prepare:(sql:string)=>D1Statement,values:unknown[]=[]):Wired {
  return {native,
    bind:(...bound:unknown[])=>{const wired=wireValues(sql,bound);return wrap(native.bind(...wired),sql,prepare,wired);},
    first:(...args:[])=>native.first(...args),
    all:(...args:[])=>planRead.test(sql)?pagedPlanRead(sql,values,prepare):native.all(...args)} as Wired;
}
/** The kit's database with large JSON parameters kept one-byte on the wire. */
export function wireDatabase(db:D1Database):D1Database {
  return {
    prepare:function prepare(sql:string):D1Statement{return wrap(db.prepare(sql),sql,prepare);},
    batch:statements=>db.batch(statements.map(statement=>(statement as Partial<Wired>).native??statement)),
  };
}
