import { createContext, useContext, useState, type ReactNode } from 'react';
import { useApiResource } from '../../app/api-client';
import { useHydrated } from '../../app/initial-resources';
import { emojis, reactionsSchema } from './schema';
import './reactions.css';

const ReactionContext=createContext<ReturnType<typeof useReactionState>|null>(null);
function useReactionState(identifier:string) {
  const resource=useApiResource(`/api/issues/${identifier}/reactions`,reactionsSchema,4000,{abortPendingOnDispose:false});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return {resource,busy,setBusy,error,setError};
}
export function ReactionProvider({identifier,children}:{identifier:string;children:ReactNode}) {
  return <ReactionContext.Provider value={useReactionState(identifier)}>{children}</ReactionContext.Provider>;
}
export function Reactions({identifier,targetId='',writable=true}: {identifier:string;targetId?:string;writable?:boolean}) {
  const state=useContext(ReactionContext);
  if(!state)throw new Error('Reactions require their issue provider.');
  const {resource,busy,setBusy,error,setError}=state;
  const hydrated=useHydrated();
  async function change(emoji:typeof emojis[number],own:boolean) {
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/issues/${identifier}/reactions`,{method:own?'DELETE':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetId,emoji})});
      if(!response.ok) throw new Error(`Reaction could not be saved (${response.status}).`);
      await response.arrayBuffer();resource.refreshAfterMutation();
    } catch(e) {setError(e instanceof Error?e.message:'Reaction could not be saved.');}
    finally {setBusy(false);}
  }
  return <div className="issue-reactions" role="group" aria-label={targetId?'Comment reactions':'Description reactions'}>
    {!targetId&&<span>Description reactions</span>}
    {emojis.map(emoji=>{
      const people=resource.data?.reactions.filter(r=>r.targetId===targetId&&r.emoji===emoji)??[];
      const own=people.some(r=>r.own);
      if(!writable&&!people.length)return null;
      return <span className="issue-reaction" key={emoji}>
        <button type="button" aria-label={`${own?'Remove':'Add'} ${emoji} reaction`} aria-pressed={own} disabled={!writable||!hydrated||busy} onClick={()=>void change(emoji,own)}>{emoji} {people.length||''}</button>
        {people.length>0&&<details><summary aria-label={`Who reacted ${emoji}`}>Who</summary><ul>{people.map(person=><li key={person.actorId}>{person.actor}</li>)}</ul></details>}
      </span>;
    })}
    {(error||resource.error)&&<p role="alert">{error||resource.error?.message}<button type="button" onClick={resource.reload}>Refresh reactions</button></p>}
  </div>;
}
