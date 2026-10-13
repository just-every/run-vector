import { useEffect, useState } from 'react';
import { Door } from '../../app/site/door/door';
import { TeamDrawing } from '../../app/site/door/door-drawings';
import type { FirstRunState } from './repository';

export function FirstRunPage({state}:{state:FirstRunState}) {
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>setReady(true),[]);
  async function complete() {
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/setup/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});
      if(!response.ok) throw Error('Setup could not be completed. Sign in again and retry.');
      window.location.assign('/app');
    } catch(error) {setMessage(error instanceof Error ? error.message : 'Setup could not be completed');setBusy(false);}
  }
  return <Door drawing={<TeamDrawing team={state.team} prefix={state.prefix}/>}><p className="vx-door-kicker">Your workspace</p><h1>Finish setting up Vector</h1>
    <p className="vx-door-lead">Review the workspace prepared by setup. You can manage teams and workspace time in Settings after opening the app.</p>
    <dl className="vx-door-facts"><dt>Workspace</dt><dd>{state.workspace}</dd><dt>Timezone</dt><dd>{state.timezone}</dd>
      <dt>First team</dt><dd>{state.team} · {state.prefix}</dd></dl>
    <button className="vx-pill vx-pill--large" disabled={!ready||busy} onClick={complete}>{busy?'Opening workspace…':'Open my workspace'}</button>
    {message?<p className="vx-door-notice" role="alert">{message}</p>:null}
  </Door>;
}
