import { Buffer } from 'node:buffer';
import type { D1Database,D1Statement } from '../../../../../vendor/base/import-kit/src/d1/index';

/** D1 limits one call to 32 MiB, and its transport writes the whole batch as one
 * string: a single character above U+00FF anywhere in it (one em dash in one
 * issue description) makes every character of the batch two bytes. A 2,000-row
 * import then passed the limit at about 1,700 rows and failed with a 503.
 * Strings that hold such a character are sent as ASCII JSON escapes instead and
 * decoded by SQLite to the identical text, so the batch stays one-byte. The
 * import statements and the archive export (which stages every row of a page in
 * one batch) both use it. */
const wide=/[^\u0000-ÿ]/;
const unit=/[^\u0000-ÿ]/g;
const ascii=(text:string)=>Buffer.from(text.replace(unit,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')),'latin1').toString('latin1');
const jsonLimit=2_000_000;

/** Offsets of the bare ? placeholders outside literals, identifiers and comments;
 * null when the statement uses numbered or named parameters (left untouched). */
export function placeholders(sql:string):number[]|null {
  const found:number[]=[];
  for(let i=0;i<sql.length;i++){
    const c=sql[i];
    if(c==="'"||c==='"'||c==='`'){for(i++;i<sql.length&&!(sql[i]===c&&sql[i+1]!==c);i++)if(sql[i]===c)i++;}
    else if(c==='['){i=sql.indexOf(']',i);if(i<0)return null;}
    else if(c==='-'&&sql[i+1]==='-'){i=sql.indexOf('\n',i);if(i<0)break;}
    else if(c==='/'&&sql[i+1]==='*'){i=sql.indexOf('*/',i);if(i<0)return null;i++;}
    else if(c==='?'){if(/[0-9A-Za-z_]/.test(sql[i+1]??''))return null;found.push(i);}
    else if(c===':'||c==='@'||c==='$'){if(/[A-Za-z_]/.test(sql[i+1]??''))return null;}
  }
  return found;
}
/** The statement and values to send: strings holding a character above U+00FF
 * become ASCII, as JSON text where the placeholder feeds json_each and as a JSON
 * string decoded by json_extract(?,'$') everywhere else. */
export function wireStatement(sql:string,values:unknown[]):{sql:string;values:unknown[]} {
  if(!values.some(value=>typeof value==='string'&&wide.test(value)))return {sql,values};
  const offsets=placeholders(sql);
  if(!offsets||offsets.length!==values.length)return {sql,values};
  let text='',last=0;
  const wired=values.map((value,index)=>{
    if(typeof value!=='string'||!wide.test(value))return value;
    const offset=offsets[index];
    if(/json_each\(\s*$/i.test(sql.slice(Math.max(0,offset-24),offset))){
      const escaped=ascii(value);
      return Buffer.byteLength(escaped)<=jsonLimit?escaped:value;
    }
    const quoted=ascii(JSON.stringify(value));
    if(Buffer.byteLength(quoted)>jsonLimit)return value;
    text+=sql.slice(last,offset)+"json_extract(?,'$')";last=offset+1;
    return quoted;
  });
  return {sql:text+sql.slice(last),values:wired};
}

/** Every batch publication reloads the whole retained plan in one SELECT whose
 * result is two-byte as well when any chunk holds such a character. The chunks
 * are immutable once created, so reading them in a few pages returns the same
 * rows. */
const planRead=/^SELECT \* FROM ik_d1_plan_chunks WHERE job_id IN \(SELECT value FROM json_each\(\?\)\).* ORDER BY job_id,ordinal$/;
const planPage=3;
async function pagedPlanRead(db:D1Database,sql:string,values:unknown[]) {
  const results:Record<string,unknown>[]=[];
  for(let offset=0;;offset+=planPage){
    const page=await db.prepare(`${sql} LIMIT ${planPage} OFFSET ${offset}`).bind(...values).all();
    results.push(...page.results);
    if(page.results.length<planPage)return {results};
  }
}

type Wired=D1Statement&{native:D1Statement;run:()=>Promise<unknown>;raw:(...args:unknown[])=>Promise<unknown>};
function wrap(db:D1Database,sql:string,values:unknown[]|null):Wired {
  const wired=values&&wireStatement(sql,values);
  const native=(wired?db.prepare(wired.sql).bind(...wired.values):db.prepare(sql)) as D1Statement&{run:()=>Promise<unknown>;raw:(...args:unknown[])=>Promise<unknown>};
  return {native,
    bind:(...bound:unknown[])=>wrap(db,sql,bound),
    first:(...args:[])=>native.first(...args),
    all:(...args:[])=>values&&planRead.test(sql)?pagedPlanRead(db,sql,wired!.values):native.all(...args),
    run:()=>native.run(),
    raw:(...args:unknown[])=>native.raw(...args)} as Wired;
}
/** The database with every statement kept one-byte on the wire; other members
 * (exec, dump, sessions) are the original's. */
export function wireDatabase<T extends D1Database>(db:T):T {
  const wired={
    prepare:(sql:string)=>wrap(db,sql,null),
    batch:(statements:D1Statement[])=>db.batch(statements.map(statement=>(statement as Partial<Wired>).native??statement)),
  };
  return new Proxy(db,{get:(target,key)=>key in wired?wired[key as keyof typeof wired]:typeof target[key as keyof T]==='function'?(target[key as keyof T] as (...args:unknown[])=>unknown).bind(target):target[key as keyof T]});
}
