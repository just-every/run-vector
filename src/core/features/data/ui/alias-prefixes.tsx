import {z} from 'zod';
import {useState} from 'react';
import {useApiResource,fetchJson} from '../../../app/api-client';
const schema=z.object({prefixes:z.array(z.object({prefix:z.string(),active:z.number()}))});
export function AliasPrefixes() {
 const resource=useApiResource('/api/data/aliases/prefixes',schema);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const save=async(prefix:string,active:boolean)=>{
  setBusy(true);setMessage('');
  try{await fetchJson('/api/data/aliases/prefixes/'+encodeURIComponent(prefix),z.object({prefix:z.string(),active:z.boolean()}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active})});resource.publishReceipt(current=>({prefixes:(current?.prefixes??[]).map(row=>row.prefix===prefix?{...row,active:Number(active)}:row)}));setMessage(prefix+' aliases '+(active?'enabled.':'disabled.'));}
  catch(error){setMessage(error instanceof Error?error.message:'The prefix could not be saved.');}finally{setBusy(false);}
 };
 if(!resource.data?.prefixes.length)return null;
 return <section aria-label="Imported aliases"><h3>Imported aliases</h3><p>Imports retain their old identifiers. Prefixes from Owner-reviewed imports start active; other imports need Owner activation. The Owner can disable a source prefix for bookmark links, source URL search and Git automation. Native identifiers always win.</p>
  {resource.data.prefixes.map(row=><label className="import-ack" key={row.prefix}><input type="checkbox" checked={row.active===1} disabled={busy} onChange={event=>void save(row.prefix,event.target.checked)}/>{row.prefix} aliases active</label>)}
  {message&&<p role="status">{message}</p>}
 </section>;
}
