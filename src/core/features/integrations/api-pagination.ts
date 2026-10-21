import { z } from 'zod';
import { sha256 } from '../../../../vendor/base/integrations/core/crypto';
import { IntegrationError } from './errors';
import { PaginationInvalidated } from '../issues/list-revision';
export const pageQuery = z.object({limit:z.coerce.number().int().min(1).max(100).default(50),cursor:z.string().max(2048).optional()});
const cursorSchema=z.object({offset:z.number().int().min(0).max(250000),revision:z.string().max(200),scope:z.string().length(64)}).strict();
export async function pageScope(actor:string,kind:string,query:unknown){return sha256(JSON.stringify([actor,kind,query]));}
export function decodeCursor(cursor:string|undefined,scope:string){
 if(!cursor)return {offset:0,revision:''};
 let value:z.infer<typeof cursorSchema>;
 try{value=cursorSchema.parse(JSON.parse(atob(cursor)));}catch{throw new IntegrationError(400,'invalid_cursor');}
 if(value.scope!==scope)throw new PaginationInvalidated();
 return value;
}
export function nextCursor(offset:number,revision:string,scope:string){return btoa(JSON.stringify({offset,revision,scope}));}
/** Snapshot hash includes ordering and projected values. A changed result must restart. */
export async function paginate<T>(rows:T[],actor:string,kind:string,query:unknown,page:z.output<typeof pageQuery>){
 const scope=await pageScope(actor,kind,[query,page.limit]),revision=await sha256(JSON.stringify(rows)),cursor=decodeCursor(page.cursor,scope);
 if(page.cursor&&cursor.revision!==revision)throw new PaginationInvalidated();
 const items=rows.slice(cursor.offset,cursor.offset+page.limit),offset=cursor.offset+items.length;
 return {items,total:rows.length,nextCursor:offset<rows.length?nextCursor(offset,revision,scope):null};
}
