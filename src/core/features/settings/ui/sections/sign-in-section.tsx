import { useId, useState } from 'react'
import { fetchJson, useApiResource } from '../../../../app/api-client'
import { googleSettingsSchema } from '../../../auth/google-schema'
import { useHydrated } from '../../../../app/initial-resources'
import { SectionGate } from '../shell/section-gate'
import { SectionPage, Skeleton } from '../shell/section-page'
import { SwitchField } from '../fields/switch-field'
import './profile.css'

function GoogleFields() {
  const resource=useApiResource('/api/settings/sign-in/google',googleSettingsSchema)
  const hydrated=useHydrated(),id=useId()
  const [clientId,setClientId]=useState<string|null>(null),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const data=resource.data
  if(!data) return resource.error?<p role="alert">Couldn’t load sign-in settings. <button className="field-retry" onClick={resource.reload}>Retry</button></p>:<Skeleton />
  async function save(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setMessage('')
    try {
      const next=await fetchJson('/api/settings/sign-in/google',googleSettingsSchema,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:clientId??data!.clientId,clientSecret:secret})})
      setSecret('');resource.publishReceipt(()=>next);setMessage('Saved. Run a test sign-in before enabling Google.')
    } catch(error) {setMessage(error instanceof Error?error.message:'Couldn’t save Google settings.')}
    finally {setBusy(false)}
  }
  return <div className="profile-body">
    <p>Google is optional. Members can continue to use their email sign-in link.</p>
    <div className="field"><label htmlFor={id+'-redirect'}>Authorized redirect URI</label><input id={id+'-redirect'} type="text" value={data.redirectUri} readOnly /></div>
    <div className="field"><label htmlFor={id+'-origin'}>JavaScript origin</label><input id={id+'-origin'} type="text" value={data.javascriptOrigin} readOnly /></div>
    <form className="profile-hours" onSubmit={save}>
      <div className="field"><label htmlFor={id+'-client'}>Google client ID</label><input id={id+'-client'} type="text" value={clientId??data.clientId} onChange={e=>setClientId(e.target.value)} required maxLength={512} autoComplete="off" disabled={!hydrated||busy} /></div>
      <div className="field"><label htmlFor={id+'-secret'}>Google client secret</label><input id={id+'-secret'} type="password" value={secret} onChange={e=>setSecret(e.target.value)} required maxLength={4096} autoComplete="new-password" disabled={!hydrated||busy} /></div>
      <div><button className="button-quiet" type="submit" disabled={!hydrated||busy}>{busy?'Saving…':'Save Google client'}</button></div>
    </form>
    {data.configured&&!data.enabled&&<form method="post" action="/api/settings/sign-in/google/test"><button className="button-quiet" type="submit">Test Google sign-in</button></form>}
    {data.tested&&<p role="status">Google test sign-in passed.</p>}
    {data.configured&&<SwitchField label="Offer Google sign-in" value={data.enabled} hint={data.tested?undefined:'Complete a test sign-in first.'} save={async enabled=>{
      const next=await fetchJson('/api/settings/sign-in/google/enabled',googleSettingsSchema,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled})})
      resource.publishReceipt(()=>next)
    }} />}
    {message&&<p role="status">{message}</p>}
  </div>
}
export function SignInSection() {
  return <SectionGate section="sign-in" title="Sign-in"><SectionPage title="Sign-in"><GoogleFields /></SectionPage></SectionGate>
}
