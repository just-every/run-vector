import type {DoorRequest} from '../roles/doors';
import type {RowId} from '../roles/matrix';
import {visibilityDatabase} from '../roles/visibility-database';

async function subject(request:DoorRequest):Promise<{kind:string;id:string}|null>{
 if(request.params.identifier){const issue=await request.db.prepare('SELECT id FROM issues WHERE identifier=?').bind(request.params.identifier).first<{id:string}>();return issue?{kind:'issue',id:issue.id}:null;}
 if(request.params.documentId)return request.db.prepare('SELECT parent_kind kind,parent_id id FROM documents WHERE id=?').bind(request.params.documentId).first<{kind:string;id:string}>();
 const body=await request.body();if(!body||typeof body!=='object')return null;
 const {parentKind:kind,parentId:id}=body as Record<string,unknown>;
 return typeof kind==='string'&&typeof id==='string'?{kind,id}:null;
}
export async function documentDoorRow(request:DoorRequest):Promise<RowId|null>{
 const parent=await subject(request);
 const role=await request.db.prepare('SELECT role FROM operators WHERE id=?').bind(request.actor).first<string>('role');
 return role==='guest'&&parent&&['team','initiative'].includes(parent.kind)?null:'documents.write';
}
export async function documentDoorTeams(request:DoorRequest):Promise<string[]|null>{
 const parent=await subject(request);if(!parent)return null;
 const db=visibilityDatabase(request.db,request.actor);
 if(parent.kind==='issue'){const row=await db.prepare('SELECT team_id id FROM issues WHERE id=?').bind(parent.id).first<{id:string}>();return row?[row.id]:null;}
 if(parent.kind==='project'){
  const rows=(await db.prepare('SELECT DISTINCT team_id id FROM issues WHERE project_id=?').bind(parent.id).all<{id:string}>()).results;
  return rows.length?rows.map(r=>r.id):null;
 }
 return [];
}
