import {env} from 'cloudflare:workers';
import {proveViewerRoleUpgrade} from './viewer-role-upgrade';
import { expect,it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';
import {sampleOwner,sampleBindings} from './sample-auth-fixture';
import {request} from './base-auth-fixture';

it('[PROJ-001 DATA-005 BASE-OPS-002] populated project and previous-head upgrades preserve records and export the extended planning inventory',async()=>{
  await proveViewerRoleUpgrade();
  await provePopulatedUpgrade('0062_project_fields.sql',{
    until:'0062_project_fields.sql',preserveAfter:'0113_description_thread_anchors.sql',
    added:['table project_labels','index project_labels_label_idx','trigger project_dates_insert','trigger project_dates_update','trigger project_label_admission','trigger project_label_update_admission','trigger project_label_usage'],
    changed:['table projects','table labels'],removed:[],
  },['projects','labels'],undefined,async()=>{
    const issue=(await env.DB.prepare('SELECT id FROM issues LIMIT 1').first<{id:string}>())!.id;
    const actor=(await env.DB.prepare('SELECT id,workspace_id FROM operators LIMIT 1').first<{id:string;workspace_id:string}>())!;
    await env.DB.prepare("INSERT INTO documents(id,workspace_id,parent_kind,parent_id,title,body,author_operator_id,created_at,updated_at) VALUES('01K00000000000000000000031',?,'issue',?,'synthetic-vector-upgrade-document','🧭 café 🧪',?,'2026-10-01','2026-10-01')").bind(actor.workspace_id,issue,actor.id).run();
    await env.DB.prepare("INSERT INTO document_revisions(id,document_id,version,title,body,author_operator_id,created_at) SELECT '01K00000000000000000000032',id,version,title,body,author_operator_id,created_at FROM documents WHERE id='01K00000000000000000000031'").run();
    await env.DB.prepare("UPDATE issue_comments SET description_anchor=? WHERE id='01K00000000000000000000011'").bind(JSON.stringify({quote:'retained legacy quote',start:0,end:21,removed:true})).run();
  });
  // Exercise the added source identity through native doors on the populated upgrade.
  const cookie=await sampleOwner();
  const read=async(path:string,method='GET',body?:unknown,status=200)=>{
    const response=await request('/api'+path,method,body,cookie,sampleBindings);
    expect(response.status,await response.clone().text()).toBe(status);
    return response.json() as Promise<any>;
  };
  const documentId='01K00000000000000000000031',doc=await read('/documents/'+documentId);
  const issue=(await env.DB.prepare('SELECT identifier FROM issues WHERE id=?').bind(doc.parentId).first<{identifier:string}>())!;
  const path='/issues/'+issue.identifier,quote='café 🧪';
  const root=await read(path+'/comments','POST',{body:'synthetic-vector-upgraded-thread',anchor:{documentId,quote,start:2,end:8,expectedVersion:doc.version,expectedBody:doc.body}},201);
  const reply=await read(path+'/comments','POST',{body:'synthetic-vector-upgraded-reply',parentId:root.id},201);
  let comments=(await read(path+'/discussion')).comments;
  expect(comments.find((c:any)=>c.id===root.id).anchor).toEqual({documentId,quote,start:2,end:8,removed:false});
  expect(comments.find((c:any)=>c.id==='01K00000000000000000000011').anchor).toEqual({quote:'retained legacy quote',start:0,end:21,removed:true});
  await read('/documents/'+documentId,'PATCH',{expectedVersion:doc.version,body:'synthetic-vector-removed-upgrade-source'});
  comments=(await read(path+'/discussion')).comments;
  expect(comments.find((c:any)=>c.id===root.id).anchor).toMatchObject({documentId,quote,removed:true});
  expect(comments.find((c:any)=>c.id===reply.id)).toMatchObject({parentId:root.id,body:'synthetic-vector-upgraded-reply'});
  console.log('PROBE ISSUE-008 populated upgrade: previous populated schema → native document quote and reply → source removal retains the new thread and legacy description anchor');
},180000);
