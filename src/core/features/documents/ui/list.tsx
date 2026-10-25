import {useNavigate} from '@tanstack/react-router';
import {useApiResource} from '../../../app/api-client';
import {administrationSchema} from '../../administration/schema';
import {documentList,type ParentKind} from '../schema';
import {DocumentForm,DocumentUnavailable,documentError} from './form';
import './documents.css';
export function documentWritable(role:string|undefined,kind:ParentKind){return !!role&&role!=='viewer'&&(role!=='guest'||kind==='issue'||kind==='project');}
export function DocumentsSection({parentKind,parentId,inspector=false}:{parentKind:ParentKind;parentId:string;inspector?:boolean}){
 const documents=useApiResource('/api/documents?parentKind='+parentKind+'&parentId='+parentId,documentList,undefined,{abortPendingOnDispose:false}),options=useApiResource('/api/metadata',administrationSchema,undefined,{abortPendingOnDispose:false}),navigate=useNavigate();
 const content=<>{options.error&&<p role="alert">Couldn't load document permissions. Check the connection. <button type="button" onClick={options.reload}>Retry</button></p>}{documents.loading&&!documents.data&&<p role="status">Loading documents…</p>}{documents.error&&<p role="alert">{documentError(documents.error,'load documents')} <button type="button" onClick={documents.reload}>Retry</button></p>}<ul className="document-list">{documents.data?.documents.map(doc=><li key={doc.id}><a href={'/app/documents/'+doc.id}>{doc.title}</a></li>)}</ul>{documents.data?.documents.length===0&&!inspector&&<p>No documents yet.</p>}{documents.data?.teams.map(team=><a className="document-link" key={team.id} href={'/app/teams/'+team.id}>{team.name} documents</a>)}{documents.data&&documentWritable(options.data?.viewer.role,parentKind)&&<details open={parentKind==='team'&&documents.data.documents.length===0||undefined}><summary>New document</summary><DocumentForm scope={{workspaceId:options.data!.workspace.id,operatorId:options.data!.viewer.id}} key={parentKind+':'+parentId} parentKind={parentKind} parentId={parentId} onSaved={doc=>void navigate({to:'/app/documents/$documentId',params:{documentId:doc.id}})}/></details>}</>;
 return <section className={'document-section'+(inspector?' document-inspector':'')} aria-label="Documents">{inspector?<details className="secondary-section"><summary>Documents · {documents.data?.documents.length??'…'}</summary>{content}</details>:<><h2>Documents</h2>{content}</>}</section>;
}
export function TeamDocumentsPage({teamId}:{teamId:string}){
 const data=useApiResource('/api/documents?parentKind=team&parentId='+teamId,documentList,undefined,{abortPendingOnDispose:false});
 return <main className="document-page">{data.error?<DocumentUnavailable/>:data.data?<><header><h1>{data.data.parent?.name}</h1></header><DocumentsSection parentKind="team" parentId={teamId}/></>:<p role="status">Loading team…</p>}</main>;
}
