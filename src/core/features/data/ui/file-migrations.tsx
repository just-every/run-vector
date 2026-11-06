import { useEffect,useState } from 'react';
import { z } from 'zod';
import { fetchJson,useApiResource } from '../../../app/api-client';
import { post } from './import-client';
import { migrationsSchema,migrationSchema,type MigrationReport,type MigrationSelection } from './migration-client';

export function FileMigrations({selected,onSelect,revision,busy}:{selected:MigrationSelection|null;onSelect:(value:MigrationSelection|null)=>void;revision:string;busy:boolean}) {
  const list=useApiResource('/api/data/migrations',migrationsSchema);
  const [source,setSource]=useState(''),[report,setReport]=useState<MigrationReport|null>(null),[accepted,setAccepted]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;setReport(null);setAccepted(false);setError('');
    if(selected)void fetchJson('/api/data/migrations/'+selected.id,migrationSchema).then(value=>{if(active)setReport(value);}).catch(reason=>{if(active)setError(reason.message);});
    return ()=>{active=false;};
  },[selected?.id,revision]);
  const refresh=async()=>{
    if(!selected)return;setAccepted(false);setError('');
    try{setReport(await fetchJson('/api/data/migrations/'+selected.id,migrationSchema));}catch(reason){setReport(null);setError(reason instanceof Error?reason.message:'Could not read this migration.');}
  };
  const create=async()=>{
    setWorking(true);setError('');
    try{const value=await post('/api/data/migrations',z.object({id:z.string(),source:z.string()}),{source});onSelect(value);list.reload();}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not start the migration.');}finally{setWorking(false);}
  };
  const finish=async()=>{
    if(!report||!accepted)return;setWorking(true);setError('');
    try{setReport(await post('/api/data/migrations/'+report.migration.id+'/finish',migrationSchema,{version:report.migration.version,acceptPending:true,pendingIds:report.pending.map(row=>row.id)}));setAccepted(false);list.reload();}
    catch(reason){setAccepted(false);setError(reason instanceof Error?reason.message:'Could not finish. Refresh and review the current pending list.');}finally{setWorking(false);}
  };
  const download=async()=>{
    if(!report)return;
    try{const response=await fetch('/api/data/migrations/'+report.migration.id+'/report.csv');if(!response.ok)throw Error('Could not download the migration report.');const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='migration.csv';link.click();URL.revokeObjectURL(url);}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not download the report.');}
  };
  const disabled=busy||working;
  return <section className="file-migrations" aria-labelledby="file-migrations-heading"><h3 id="file-migrations-heading">File migrations</h3>
    <p>Group reviewed files from one source workspace. Source references prefixed with <code>source:</code> can remain pending. Finish only after reviewing the current list of missing endpoints.</p>
    <div className="import-file-fields"><label>Source workspace name<input value={source} maxLength={100} disabled={disabled} onChange={event=>setSource(event.target.value)}/></label><div><button type="button" disabled={disabled||!source||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(source)} onClick={()=>void create()}>Start file migration</button></div></div>
    <label>Migration for this file<select aria-label="Migration for this file" disabled={disabled} value={selected?.id??''} onChange={event=>{const next=list.data?.migrations.find(row=>row.id===event.target.value);onSelect(next?{id:next.id,source:next.source}:null);}}><option value="">Standalone import run</option>{list.data?.migrations.map(row=><option key={row.id} value={row.id}>{row.source} · {row.state}</option>)}</select></label>
    {(error||list.error)&&<p role="alert">{error||list.error?.message}</p>}
    {report&&<section className="import-review" aria-label="Migration reconciliation"><h4>{report.migration.source} · {report.migration.state==='finished'?'Finished migration':'Open migration'}</h4><code className="migration-identity">{report.migration.id}</code><p>{report.runs.length} reviewed runs · {report.totals.rowsRead} rows read · {report.totals.issuesWritten} issues written</p>
      <ul>{report.runs.map(run=><li key={run.id}><code>{run.id}</code> · {run.state} · {run.checkpoint} of {run.total} records</li>)}</ul>
      <h4>Pending relations ({report.pending.length})</h4><References rows={report.pending}/>
      <h4>Accepted omissions ({report.omissions.length})</h4><References rows={report.omissions}/>
      <button type="button" disabled={disabled} onClick={()=>void refresh()}>Refresh migration report</button><button type="button" disabled={disabled} onClick={()=>void download()}>Download migration CSV</button>
      {report.migration.state==='open'&&<><label className="import-ack"><input type="checkbox" checked={accepted} disabled={disabled} onChange={event=>setAccepted(event.target.checked)}/>I accept this current list of {report.pending.length} pending relations as omissions.</label><button type="button" disabled={disabled||!accepted||!report.runs.length||report.runs.some(run=>run.state!=='completed')} onClick={()=>void finish()}>Finish migration</button></>}
      {report.migration.state==='finished'&&<p role="status">The accepted pending list is retained as reported omissions. This migration is finished.</p>}
    </section>}
  </section>;
}
function References({rows}:{rows:MigrationReport['pending']}) {
  return rows.length?<ul className="migration-references">{rows.map(row=><li key={row.id}><strong>{row.sourceId} → {row.targetSourceId}</strong><span>{row.kind} · source row {row.row} · {row.state}</span><code>{row.id}</code><span>Run {row.runId}</span></li>)}</ul>:<p>None.</p>;
}
