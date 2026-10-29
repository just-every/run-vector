import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { fetchJson,useApiResource } from '../../app/api-client';
import { modelSettingsSchema,featureNames,features,type ModelSettings } from './schema';
const saved=z.object({saved:z.boolean()});
const registered=z.object({id:z.string()});
async function send(path:string,body:unknown,method='POST') {
  return fetchJson('/api/settings/models'+path,path==='/providers'?registered:saved,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
export function ModelPolicyPanel({teams}:{teams:{id:string;name:string}[]}) {
  const resource=useApiResource('/api/settings/models',modelSettingsSchema);
  const [message,setMessage]=useState(''),[pending,setPending]=useState(false);
  const submit=async(action:()=>Promise<unknown>)=>{
    setPending(true);setMessage('');
    try{await action();setMessage('Model settings saved.');resource.reload();}
    catch(error){setMessage(error instanceof Error?error.message:'The model settings could not be saved.');}
    finally{setPending(false);}
  };
  return <section id="models" aria-labelledby="models-heading">
    <h2 id="models-heading">Models and data</h2>
    <p>Every feature starts disabled. Workspace off overrides every team. Team off overrides workspace on. Previews send only the listed issue fields and never apply a change.</p>
    {resource.error&&<p role="alert">{resource.error.message}</p>}
    {message&&<p role="status">{message}</p>}
    {resource.data&&<>
      <ProviderForm pending={pending} submit={submit}/>
      <h3>Provider disclosures</h3>
      {resource.data.providers.length===0&&<p>No provider is connected.</p>}
      {resource.data.providers.map(provider=><div key={provider.id} className="settings-confirm">
        <h4>{provider.name}</h4><p>{provider.model} · {provider.endpoint}</p>
        {provider.termsUrl?<p><a href={provider.termsUrl} rel="noreferrer" target="_blank">Provider terms</a> · {provider.noTraining?'Customer content is not used for training.':'No training confirmation is missing.'}</p>:<p>An Owner must record terms before this provider can be enabled.</p>}
        <p>Data: {provider.data.join(', ')}. Retention: {provider.retention??'Not recorded.'}</p>
        <p>{provider.confirmedAt?'Owner confirmed: '+provider.confirmedAt:provider.kind==='anthropic'?'Published commercial API declaration.':'No Owner confirmation.'} {!provider.ready&&'Credential re-entry required.'}</p>
        {resource.data!.owner&&provider.kind==='self-hosted'&&<TermsForm id={provider.id} pending={pending} submit={submit}/>}
        <details><summary>Replace provider credential</summary><form aria-label="Replace model credential" onSubmit={event=>{
          event.preventDefault();const form=event.currentTarget,values=new FormData(form);
          void submit(async()=>{await send('/providers/'+provider.id+'/credential',{credential:values.get('credential')},'PUT');form.reset();});
        }}><label>New provider credential<input name="credential" type="password" required autoComplete="off" maxLength={4096}/></label><p>Replacing a credential disables affected policies until explicitly enabled again.</p><button type="submit" disabled={pending}>Replace credential</button></form></details>
        <button type="button" disabled={pending} onClick={()=>void submit(()=>send('/providers/'+provider.id,undefined,'DELETE'))}>Remove {provider.name}</button>
      </div>)}
      <PolicyForm key={JSON.stringify(resource.data.policies)+resource.data.providers.map(p=>p.id).join('')} data={resource.data} teams={teams} pending={pending} submit={submit}/>
    </>}
  </section>;
}
type Actions={pending:boolean;submit:(action:()=>Promise<unknown>)=>Promise<void>};
function ProviderForm({pending,submit}:Actions) {
  const [kind,setKind]=useState<'anthropic'|'self-hosted'>('anthropic');
  const save=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget,values=new FormData(form);
    void submit(async()=>{await send('/providers',{kind,name:values.get('name'),model:values.get('model'),endpoint:kind==='anthropic'?'https://api.anthropic.com/v1/messages':values.get('endpoint'),credential:values.get('credential')});form.reset();setKind('anthropic');});
  };
  return <details><summary>Connect a model provider</summary><form onSubmit={save} aria-label="Connect model provider"><fieldset disabled={pending}>
    <label>Provider type<select value={kind} onChange={event=>setKind(event.target.value as typeof kind)}><option value="anthropic">Anthropic API</option><option value="self-hosted">Self-hosted Messages API</option></select></label>
    <p>Messages API format. Self-hosted providers require explicit Owner terms and an enforcing outbound connection.</p>
    <label>Provider name<input name="name" required maxLength={100}/></label>
    <label>Model name<input name="model" required maxLength={120}/></label>
    {kind==='self-hosted'&&<label>HTTPS Messages endpoint<input name="endpoint" type="url" required maxLength={1000}/></label>}
    <label>Provider credential<input name="credential" type="password" required autoComplete="off" maxLength={4096}/></label>
    <button type="submit">Connect provider</button>
  </fieldset></form></details>;
}
function TermsForm({id,pending,submit}:Actions&{id:string}) {
  return <details><summary>Owner terms confirmation</summary><form aria-label="Owner provider terms" onSubmit={event=>{
    event.preventDefault();const values=new FormData(event.currentTarget);
    void submit(()=>send('/providers/'+id+'/confirm',{termsUrl:values.get('termsUrl'),retention:values.get('retention'),noTraining:values.get('noTraining')==='on'}));
  }}><fieldset disabled={pending}>
    <label>Terms URL<input name="termsUrl" required type="url" maxLength={1000}/></label>
    <label>Retention terms<input name="retention" required maxLength={500}/></label>
    <label><input type="checkbox" name="noTraining" required/>I confirm these terms do not permit training on customer content.</label>
    <p>This Owner confirmation is audited. Confirming revised terms disables features using this provider until separately enabled again.</p>
    <button type="submit">Record terms and confirm</button>
  </fieldset></form></details>;
}
function PolicyForm({data,teams,pending,submit}:Actions&{data:ModelSettings;teams:{id:string;name:string}[]}) {
  const [feature,setFeature]=useState<typeof features[number]>('triage'),[team,setTeam]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const current=data.policies.find(row=>row.feature===feature&&(row.teamId??'')===team);
  const choice=selected??current?.providerId??'',provider=data.providers.find(row=>row.id===choice);
  return <form aria-label="Model feature policy" onSubmit={event=>{
    event.preventDefault();const values=new FormData(event.currentTarget);
    void submit(()=>send('/policy',{feature,teamId:team||null,enabled:values.get('enabled')==='on',providerId:String(values.get('providerId')||'')||null},'PUT'));
  }}><h3>Feature controls</h3><fieldset disabled={pending}>
    <label>Model feature<select value={feature} onChange={event=>{setFeature(event.target.value as typeof feature);setSelected(null);}}>{features.map(id=><option key={id} value={id}>{featureNames[id]}</option>)}</select></label>
    <label>Policy scope<select value={team} onChange={event=>{setTeam(event.target.value);setSelected(null);}}><option value="">Workspace</option>{teams.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <div key={feature+team}>
      <label>Selected provider<select name="providerId" value={choice} onChange={event=>setSelected(event.target.value)}><option value="">Choose a provider</option>{data.providers.map(provider=><option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label><input name="enabled" type="checkbox" defaultChecked={current?.enabled??false}/>Enable this feature for this scope</label>
    </div>
    {provider&&<p>{provider.name}: {provider.termsUrl?<a href={provider.termsUrl} rel="noreferrer" target="_blank">Provider terms</a>:'Owner terms required'}. {provider.noTraining?'No customer-content training.':'Training status unconfirmed.'} Retention: {provider.retention??'Not recorded.'} Data: {provider.data.join(', ')}.</p>}
    <p>Current scope: {current?current.enabled?'Enabled':'Disabled':team?'Inherits workspace policy':'Disabled by default'}. Data sent: {data.features.find(row=>row.id===feature)?.data.join(', ')}.</p>
    <p>The selected provider’s terms, training policy and retention are shown above. Semantic search, Ask Vector and drafting inherit these controls when their feature journeys ship.</p>
    <button type="submit">Save model policy</button>
  </fieldset></form>;
}
