import {useState} from 'react';
import {z} from 'zod';
import {ApiError} from '../../../app/api-client';
import {CopyButton,CopyField} from './copy-field';
import {sourceRequest,sourceScript,type SourceConnection} from './source-sender';
import {SourceTools} from './source-tools';
const responseSchema=z.object({identifier:z.string(),reused:z.boolean()});

export function SourceSetup({connection,secret}:{connection:SourceConnection;secret?:string}){
 const [mode,setMode]=useState<'plain'|'signed'>(secret&&!connection.webhookUrl?'signed':'plain'),[savedSecret,setSavedSecret]=useState(''),[savedUrl,setSavedUrl]=useState(''),[title,setTitle]=useState('Source connection test'),[summary,setSummary]=useState('A report sent from the Vector source setup page.'),[record,setRecord]=useState<string>(()=>crypto.randomUUID()),[revision,setRevision]=useState('1'),[observedAt]=useState(()=>new Date().toISOString()),[busy,setBusy]=useState(false),[result,setResult]=useState<z.infer<typeof responseSchema>|null>(null),[error,setError]=useState('');
 const report={teamId:connection.teamId,title,summary,sourceRecordId:record,sourceRevisionId:revision,observedAt};
 const url=connection.webhookUrl??savedUrl;
 const send=async()=>{setBusy(true);setError('');setResult(null);try{
  let wire:{url:string;headers:HeadersInit;body:string};
  if(mode==='signed')wire=await sourceRequest(connection,secret??savedSecret,report);
  else{
   const parsed=new URL(url),receiver=new URL(connection.receiver);
   if(parsed.origin!==receiver.origin||parsed.search||parsed.hash||!new RegExp('^'+receiver.pathname.replace(/\/events$/,'')+'/receive/[a-f0-9]{64}$').test(parsed.pathname))throw new Error('Paste the secret webhook URL issued for this source.');
   wire={url,headers:{'content-type':'application/json'},body:JSON.stringify({title,summary,sourceRecordId:record,sourceRevisionId:revision})};
  }
  const response=await fetch(wire.url,{method:'POST',headers:wire.headers,body:wire.body,credentials:'omit'});const body:unknown=await response.json().catch(()=>null);if(!response.ok)throw new ApiError(response.status,body);setResult(responseSchema.parse(body));
 }catch(error){setError(error instanceof Error?error.message:'The report could not be sent.');}finally{setBusy(false);}};
 return <section className="integration-setup" aria-label="Source connection setup">
 <div className="integration-actions"><button type="button" aria-pressed={mode==='plain'} onClick={()=>setMode('plain')}>Webhook URL</button><button type="button" aria-pressed={mode==='signed'} onClick={()=>setMode('signed')}>Signed sender</button></div>
 {mode==='plain'?<><p>Paste the secret webhook URL into your tool’s POST action. Save it now; Vector only reveals it when created or replaced.</p>{connection.webhookUrl?<div data-rer-private><CopyField label="Secret webhook URL" value={connection.webhookUrl}/></div>:<label>Saved secret webhook URL<input type="password" autoComplete="off" value={savedUrl} onChange={event=>setSavedUrl(event.target.value)} data-rer-private/></label>}<SourceTools/></>:<><CopyField label="Signed source receiver URL" value={connection.receiver}/>{!secret&&<label>Saved source secret<input type="password" autoComplete="off" value={savedSecret} onChange={event=>setSavedSecret(event.target.value)} data-rer-private/></label>}</>}
 <p>Send a report to create a real issue in Needs decision for the selected team.</p>
 <div className="integration-fields"><label>Report title<input required maxLength={500} value={title} onChange={event=>setTitle(event.target.value)}/></label><label>Report ID<input aria-label="Report ID" maxLength={128} value={record} onChange={event=>setRecord(event.target.value)}/><small>Keep this ID for later updates to the same report.</small></label><label>Update ID<input aria-label="Update ID" maxLength={128} value={revision} onChange={event=>setRevision(event.target.value)}/><small>Use a new value when the report changes.</small></label></div>
 <label>What happened<textarea maxLength={100000} value={summary} onChange={event=>setSummary(event.target.value)}/></label>
 <button type="button" disabled={busy||!title.trim()||!record||!revision||!(mode==='plain'?url:secret??savedSecret)} onClick={()=>void send()}>{busy?'Sending report…':mode==='plain'?'Send webhook test report':'Send signed test report'}</button>
 {error&&<p role="alert">{error}</p>}{result&&<p role="status">{result.reused?'Already received':'Report received'}: <a href={'/app/issues/'+encodeURIComponent(result.identifier)}>{result.identifier}</a>. Open the issue to see the source evidence. New reports appear in Needs decision.</p>}
 {mode==='signed'&&<details><summary>Connect a script or code action</summary><ol><li>Save this sender as <code>vector-source.mjs</code> in a Node.js 22 or later automation runner.</li><li>Set <code>VECTOR_SOURCE_SECRET</code> in that system’s secret store to the source signing secret.</li><li>Map the report title, summary, report ID, update ID and observation time. Run the action and check the response’s identifier in Vector.</li></ol><CopyButton label="Copy source sender" value={sourceScript(connection,report)}/><pre tabIndex={0}><code>{sourceScript(connection,report)}</code></pre><p>401: check the signing secret and sender clock (within five minutes). 409: use a new update ID for changed content. 410: the original issue was deleted.</p></details>}
 </section>;
}
