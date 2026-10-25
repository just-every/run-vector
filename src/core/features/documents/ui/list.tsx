import {useNavigate} from '@tanstack/react-router';
import {useApiResource} from '../../../app/api-client';
import {administrationSchema} from '../../administration/schema';
import {documentList,type ParentKind} from '../schema';
import {DocumentForm} from './form';
import './documents.css';
export function documentWritable(role:string|undefined,kind:ParentKind){return !!role&&role!=='viewer'&&(role!=='guest'||kind==='issue'||kind==='project');}
export function DocumentsSection({parentKind,parentId}:{parentKind:ParentKind;parentId:string}){
 const documents=useApiResource('/api/documents?parentKind='+parentKind+'&parentId='+parentId,documentList,undefined,{abortPendingOnDispose:false}),options=useApiResource('/api/metadata',administrationSchema,undefined,{abortPendingOnDispose:false}),navigate=useNavigate();
 return <section className="document-section" aria-label="Documents"><h2>Documents</h2>{documents.loading&&!documents.data&&<p role="status">Loading documents…</p>}{documents.error&&<p role="alert">{documents.error.message}</p>}<ul className="document-list">{documents.data?.documents.map(doc=><li key={doc.id}><a href={'/app/documents/'+doc.id}>{doc.title}</a></li>)}</ul>{documents.data?.documents.length===0&&<p>No documents yet.</p>}{documents.data&&documentWritable(options.data?.viewer.role,parentKind)&&<details><summary>New document</summary><DocumentForm parentKind={parentKind} parentId={parentId} onSaved={doc=>void navigate({to:'/app/documents/$documentId',params:{documentId:doc.id}})}/></details>}</section>;
}
export function TeamDocumentsPage({teamId}:{teamId:string}){
 const data=useApiResource('/api/documents?parentKind=team&parentId='+teamId,documentList,undefined,{abortPendingOnDispose:false});
 return <main className="document-page"><header><h1>{data.data?.parent?.name??'Team documents'}</h1></header>{data.error?<p role="alert">{data.error.message}</p>:data.data?<DocumentsSection parentKind="team" parentId={teamId}/>:<p role="status">Loading team…</p>}</main>;
}
