import type {ProductionFollowup} from '../schema';

// The question is answered in the issue's own discussion, just below.
function answer(){
 const composer=document.querySelector<HTMLTextAreaElement>('.comment-composer textarea');
 composer?.scrollIntoView({block:'center'});composer?.focus();
}
/** Each recorded merge: when it reached production, or the one question its assignee was asked. */
export function ProductionFollowups({followups,writable}:{followups:ProductionFollowup[];writable:boolean}){
 return <><h3>Production follow-up</h3><ul className="production-followups">{followups.map(f=><li key={f.repository+':'+f.sha+':'+f.pullNumber}>
  <span>{f.repository} #{f.pullNumber} merged <time dateTime={f.mergedAt}>{new Date(f.mergedAt).toISOString()}</time> · {f.sha.slice(0,7)}</span>
  {f.productionAt?<span> · reached production <time dateTime={f.productionAt}>{new Date(f.productionAt).toISOString()}</time></span>:!f.askedAt&&<span> · waiting for production</span>}
  {f.askedAt&&<p role="note">Deployment follow-up asked {f.recipient??'the assignee'} why this merge has not reached production · <time dateTime={f.askedAt}>{new Date(f.askedAt).toISOString()}</time>
   {f.answeredAt?<span> · answered in the discussion <time dateTime={f.answeredAt}>{new Date(f.answeredAt).toISOString()}</time></span>
    :writable&&<> <button type="button" onClick={answer}>Answer in discussion</button></>}</p>}
 </li>)}</ul></>;
}
