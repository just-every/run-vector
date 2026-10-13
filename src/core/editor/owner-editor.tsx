import { useEffect,useState } from 'react';
import { configLoader,createOwnerEditor } from '../../../vendor/base/editor/index';
import type { Session } from '../../../vendor/base/operator-auth/index.mjs';
import { privateReads } from '../app/read-lifecycle';

export function OwnerEditorShell() {
  const [error,setError]=useState('');
  useEffect(()=>{
    const editor=createOwnerEditor(),controller=new AbortController();
    let identity='',pending=false,stopped=false,generation=0;
    const revoke=()=>{generation++;identity='';editor.setOwner(false);};
    const refresh=async()=>{
      if(pending||stopped||privateReads.paused)return;
      pending=true;const current=generation;
      try {
        const response=await fetch('/api/editor/config',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
        if(current!==generation||stopped)return;
        if(response.status===503) {
          const body=await response.json();revoke();
          if(body && typeof body==='object' && 'error' in body && body.error==='editor_not_configured'){setError('');return;}
          throw Error('Editor authorization is unavailable.');
        }
        if(response.status===403){revoke();setError('');return;}
        if(!response.ok){revoke();throw Error('Editor owner authorization has expired.');}
        const sessionResponse=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
        if(current!==generation||stopped)return;
        if(!sessionResponse.ok){revoke();throw Error('Sign in again to use the editor.');}
        const session=await sessionResponse.json() as Session;
        if(current!==generation||stopped)return;
        if(session.operator.role!=='owner'){revoke();return;}
        const next=JSON.stringify([session.id,session.operatorId,session.operator.version]);
        if(next!==identity){editor.setOwner(true);identity=next;}
        await editor.refresh(configLoader('/api/editor/config',location.origin));
        if(current===generation&&!stopped)setError('');
      } catch(error){if(!stopped){revoke();setError(error instanceof Error?error.message:'Editor unavailable.');}}
      finally{pending=false;}
    };
    const lost=()=>revoke(),changed=()=>{revoke();void refresh();},focused=()=>void refresh();
    window.addEventListener('vector:auth-lost',lost);window.addEventListener('vector:auth-changed',changed);window.addEventListener('focus',focused);
    const resume=privateReads.onResume(()=>void refresh()),timer=setInterval(()=>void refresh(),20_000);
    void refresh();
    return()=>{stopped=true;controller.abort();resume();clearInterval(timer);editor.dispose();window.removeEventListener('vector:auth-lost',lost);window.removeEventListener('vector:auth-changed',changed);window.removeEventListener('focus',focused);};
  },[]);
  return error?<p role="alert" className="account-error">{error}</p>:null;
}
