import { useState } from 'react';
import { fetchJson } from '../../app/api-client';
import { previewSchema } from './schema';
export function ModelPreview({identifier}:{identifier:string}) {
  const [text,setText]=useState(''),[pending,setPending]=useState(false);
  return <div><button type="button" disabled={pending} onClick={async()=>{
    setPending(true);setText('');
    try{const result=await fetchJson('/api/issues/'+identifier+'/triage-suggestion',previewSchema,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});setText(result.enabled?'Suggestion from '+result.model+' · Records: '+result.records?.join(', ')+' · '+result.at+'. '+result.suggestion:'Triage suggestions are disabled for this workspace or team.');}
    catch(error){setText(error instanceof Error?error.message:'The model preview could not be loaded.');}
    finally{setPending(false);}
  }}>Preview model suggestion</button>{text&&<p role="status">{text}</p>}</div>;
}
