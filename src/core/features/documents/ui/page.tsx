import {useEffect,useId,useState} from 'react';
import {fetchJson,useApiResource} from '../../../app/api-client';
import {administrationSchema} from '../../administration/schema';
import {SafeMarkdown} from '../../markdown/ui/markdown';
import {MentionTextarea} from '../../notifications/ui/mention-textarea';
import {documentDetail,documentList,revisionList} from '../schema';
import {DocumentForm,type Document} from './form';
import {documentWritable} from './list';
import './documents.css';
export function DocumentPage({documentId}:{documentId:string}){
 const data=useApiResource('/api/documents/'+documentId,documentDetail);
 if(!data.data)return <main className="document-page">{data.error?<p role="alert">{data.error.message}</p>:<p role="status">Loading document…</p>}</main>;
 return <DocumentContent document={data.data} onSaved={doc=>{data.publishReceipt(()=>doc);data.refreshAfterMutation();}}/>;
}
function DocumentContent({document,onSaved}:{document:Document;onSaved:(value:Document)=>void}){
 const id=useId(),options=useApiResource('/api/metadata',administrationSchema),parent=useApiResource('/api/documents?parentKind='+document.parentKind+'&parentId='+document.parentId,documentList),history=useApiResource('/api/documents/'+document.id+'/revisions',revisionList);
 const [comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[older,setOlder]=useState<NonNullable<typeof history.data>['revisions']>([]),[cursor,setCursor]=useState<number|null|undefined>(undefined);
 const writable=documentWritable(options.data?.viewer.role,document.parentKind);
 useEffect(()=>{setOlder([]);setCursor(undefined);history.reload();},[document.version]);
 async function post(){setBusy(true);setError('');try{onSaved(await fetchJson('/api/documents/'+document.id+'/comments',documentDetail,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:comment})}));setComment('');}catch(cause){setError(cause instanceof Error?cause.message:'The comment could not be posted.');}finally{setBusy(false);}}
 async function earlier(){const before=cursor===undefined?history.data?.nextBeforeVersion:cursor;if(!before)return;setBusy(true);setError('');try{const page=await fetchJson('/api/documents/'+document.id+'/revisions?beforeVersion='+before,revisionList);setOlder(current=>[...page.revisions,...current]);setCursor(page.nextBeforeVersion);}catch(cause){setError(cause instanceof Error?cause.message:'Earlier revisions could not be loaded.');}finally{setBusy(false);}}
 return <main className="document-page"><header>{parent.data?.parent&&<a href={parent.data.parent.url}>{parent.data.parent.name}</a>}<h1>{document.title}</h1><p>By {document.authorName}</p></header><section aria-label="Document content"><SafeMarkdown>{document.body}</SafeMarkdown></section>{writable&&<details className="document-section"><summary>Edit document</summary><DocumentForm key={document.version} parentKind={document.parentKind} parentId={document.parentId} existing={document} onSaved={onSaved}/></details>}<details className="document-section"><summary>Revision history</summary>{history.error&&<p role="alert">{history.error.message}</p>}{history.loading&&!history.data&&<p role="status">Loading revisions…</p>}<ol className="document-revisions">{[...older,...(history.data?.revisions??[])].map(revision=><li key={revision.id}><h2>Revision {revision.version}</h2><p>{revision.authorName}</p><SafeMarkdown>{revision.body}</SafeMarkdown></li>)}</ol>{(cursor===undefined?history.data?.nextBeforeVersion:cursor)&&<button type="button" disabled={busy} onClick={()=>void earlier()}>Earlier revisions</button>}</details><section className="document-section" aria-label="Document comments"><h2>Comments</h2><ul className="document-comments">{document.comments.map(item=><li key={item.id}><strong>{item.authorName}</strong><SafeMarkdown>{item.body}</SafeMarkdown></li>)}</ul>{document.comments.length===0&&<p>No comments yet.</p>}{writable&&<form className="document-form" onSubmit={e=>{e.preventDefault();void post();}}><fieldset disabled={busy}><label htmlFor={id}>Comment</label><MentionTextarea id={id} value={comment} onValueChange={setComment} rows={4} maxLength={100000}/><button type="submit" disabled={!comment.trim()}>Post comment</button></fieldset></form>}</section>{(error||parent.error)&&<p role="alert">{error||parent.error?.message}</p>}</main>;
}
