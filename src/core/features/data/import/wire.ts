import { Buffer } from 'node:buffer';
import type { D1Database,D1Statement } from '../../../../../vendor/base/import-kit/src/d1/index';

/** D1 limits one batch to 32 MiB on the wire, and the runtime sends a string that
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

type Wired=D1Statement&{native:D1Statement};
function wrap(native:D1Statement,sql:string):Wired {
  return {native,
    bind:(...values:unknown[])=>wrap(native.bind(...wireValues(sql,values)),sql),
    first:(...args:[])=>native.first(...args),
    all:(...args:[])=>native.all(...args)} as Wired;
}
/** The kit's database with large JSON parameters kept one-byte on the wire. */
export function wireDatabase(db:D1Database):D1Database {
  return {
    prepare:sql=>wrap(db.prepare(sql),sql),
    batch:statements=>db.batch(statements.map(statement=>(statement as Partial<Wired>).native??statement)),
  };
}
