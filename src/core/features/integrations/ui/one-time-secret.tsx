import {useEffect,useRef,useState} from 'react';
import type {Secret} from './client';
import {CopyButton,CopyField} from './copy-field';
import {SourceSetup} from './source-setup';
import {GithubSetup} from './github-setup';
export function OneTimeSecret({value,onClose}:{value:Secret;onClose:()=>void}){
 const [visible,setVisible]=useState(false),heading=useRef<HTMLHeadingElement>(null);const credential=value.token??value.secret??value.webhookUrl;
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});},[]);
 return <section className="integration-secret" aria-labelledby="integration-secret-heading" data-rer-private><h3 id="integration-secret-heading" ref={heading} tabIndex={-1}>Save this credential once</h3><p>Vector will not show this value again. Save it in your integration’s secret store before closing this panel.</p><label>New credential<input readOnly type={visible?'text':'password'} value={credential??''} autoComplete="off" spellCheck={false}/></label><div className="integration-actions"><button type="button" onClick={()=>setVisible(!visible)}>{visible?'Hide credential':'Show credential'}</button><CopyButton value={credential??''} label="Copy credential"/></div>
 {value.kind==='source'&&value.receiver&&value.workspaceId&&value.sourceId&&value.teamId&&<SourceSetup connection={{receiver:value.receiver,workspaceId:value.workspaceId,sourceId:value.sourceId,teamId:value.teamId,webhookUrl:value.webhookUrl}} secret={value.secret}/>}
 {value.kind==='github'&&value.receiver&&value.repository&&<GithubSetup receiver={value.receiver} repository={value.repository} secret={value.secret}/>}
 {value.kind==='destination'&&value.destinationUrl&&<><CopyField label="Destination URL" value={value.destinationUrl}/><p>For a custom receiver, save this signing secret in its secret store. Zapier and Make do not need it. Close this panel, then use Send test beside the destination.</p></>}
 <button type="button" onClick={onClose}>I saved it; close</button></section>;
}
