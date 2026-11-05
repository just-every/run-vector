import type {z} from 'zod';
import {administrationContext,audit,commit,guard,SettingsError} from '../../administration/transaction';
import {IntegrationError} from '../../integrations/errors';
import {releaseAccess} from '../repository';
import {releaseNoteSource,type NoteSource,type NoteDraft,type ReleaseNotes,type editReleaseNotes,type generateReleaseNotes} from './schema';
import {currentScopeVisible,retainedSourcesVisible,sourceSnapshot,draftMarkdown} from './sources';

type Release={id:string;workspace_id:string;owner_operator_id:string|null;owner_name:string|null;version:number};
type Stored=Omit<NoteDraft,'sources'>&{sourcesJson:string};
// Names come from the reader's current operator projection: a removed person's
// retired name replaces them, while notes keep only opaque identities.
const name=(column:string)=>`(SELECT name FROM operators o WHERE o.id=${column})`;
const projection=`d.release_id AS releaseId,d.owner_operator_id AS ownerOperatorId,d.body,d.sources_json AS sourcesJson,
 d.source_release_version AS sourceReleaseVersion,d.version,d.created_at AS createdAt,d.updated_at AS updatedAt,
 v.actor_operator_id AS authorOperatorId,${name('v.actor_operator_id')} AS authorName`;
const unavailable=()=>new IntegrationError(404,'release_notes_unavailable','Release notes are unavailable.');
async function context(db:D1Database,actor:string,id:string){
 const access=await releaseAccess(db,actor);
 const release=await db.prepare(`SELECT r.id,r.workspace_id,r.owner_operator_id,r.version,${name('r.owner_operator_id')} AS owner_name FROM releases r
 WHERE r.id=? AND r.workspace_id=? AND (r.team_id IS NULL OR r.team_id IN(SELECT id FROM teams))
 AND ${currentScopeVisible}`).bind(id,access.workspace_id,id).first<Release>();
 if(!release)throw unavailable();
 return {release,canEdit:release.owner_operator_id===actor&&['owner','admin','member'].includes(access.role)};
}
const stored=(db:D1Database,id:string)=>db.prepare(`SELECT ${projection} FROM release_note_drafts d JOIN release_note_revisions v
 ON v.release_id=d.release_id AND v.version=d.version WHERE d.release_id=?`).bind(id).first<Stored>();
async function visibleSources(db:D1Database,row:Stored,release:Release){
 if(!await db.prepare(`SELECT (${retainedSourcesVisible}) AS allowed`).bind(row.sourcesJson,release.workspace_id,release.workspace_id).first<number>('allowed'))throw unavailable();
}
function project({sourcesJson,...draft}:Stored):NoteDraft{
 return {...draft,sources:releaseNoteSource.array().parse(JSON.parse(sourcesJson))};
}
export async function readReleaseNotes(db:D1Database,actor:string,id:string):Promise<ReleaseNotes>{
 const {release}=await context(db,actor,id),row=await stored(db,id);
 if(row)await visibleSources(db,row,release);
 // Revalidate after the asynchronous projection, including the retained source
 // set. A release link never grants access to old private titles in edited text.
 const current=await context(db,actor,id);
 if(row){
  const latest=await db.prepare(`SELECT version,(${retainedSourcesVisible}) AS allowed
   FROM release_note_drafts WHERE release_id=?`).bind(row.sourcesJson,current.release.workspace_id,current.release.workspace_id,id).first<{version:number;allowed:number}>();
  if(!latest||!latest.allowed)throw unavailable();
  if(latest.version!==row.version)throw new IntegrationError(409,'stale_release_notes','The notes changed. Reload before reading again.');
 }
 return {draft:row?project(row):null,canEdit:current.canEdit,releaseChanged:!!row&&row.sourceReleaseVersion!==current.release.version,ownerName:current.release.owner_name};
}
function writable(release:Release,canEdit:boolean,expected:number){
 if(!release.owner_operator_id)throw new IntegrationError(409,'release_owner_unqualified','This historical release has no qualified owner.');
 if(!canEdit)throw new IntegrationError(403,'release_owner_required','Only the release owner can draft or edit its notes.');
 if(release.version!==expected)throw new IntegrationError(409,'stale_release','The release changed. Reload before saving notes.');
}
async function save(db:D1Database,actor:string,release:Release,sourcesJson:string,body:string,version:number,sourceVersion=release.version){
 const ctx=await administrationContext(db,actor),id=release.id;
 const writes=[
  guard(ctx.db,`EXISTS(SELECT 1 FROM releases WHERE id=? AND workspace_id=? AND owner_operator_id=? AND version=?
   AND (team_id IS NULL OR team_id IN(SELECT id FROM teams))) AND ${currentScopeVisible}`,
   id,release.workspace_id,actor,release.version,id),
  guard(ctx.db,retainedSourcesVisible,sourcesJson,release.workspace_id,release.workspace_id),
 ];
 if(version===1)writes.push(
  guard(ctx.db,`NOT EXISTS(SELECT 1 FROM release_note_drafts WHERE release_id=?) AND (${sourceSnapshot})=?`,id,id,sourcesJson),
  ctx.db.prepare(`INSERT INTO release_note_drafts(release_id,owner_operator_id,body,sources_json,source_release_version,version,created_at,updated_at)
   VALUES(?,?,?,?,?,1,?,?)`).bind(id,actor,body,sourcesJson,release.version,ctx.at,ctx.at),
 );
 else writes.push(
  guard(ctx.db,'EXISTS(SELECT 1 FROM release_note_drafts WHERE release_id=? AND version=? AND owner_operator_id=?)',id,version-1,actor),
  ctx.db.prepare('UPDATE release_note_drafts SET body=?,version=?,updated_at=? WHERE release_id=?').bind(body,version,ctx.at,id),
 );
 // Source context stays the generation's context through every human revision.
 writes.push(ctx.db.prepare(`INSERT INTO release_note_revisions(release_id,version,owner_operator_id,actor_operator_id,body,sources_json,source_release_version,created_at)
  VALUES(?,?,?,?,?,?,?,?)`).bind(id,version,actor,actor,body,sourcesJson,sourceVersion,ctx.at),
  ...audit(ctx,version===1?'release.notes_drafted':'release.notes_edited',id,'Release notes',version===1?null:{version:version-1},{version}));
 try{await commit(ctx,writes);}
 catch(error){
  if(error instanceof SettingsError&&error.status===409){
   await readReleaseNotes(db,actor,id);
   throw new IntegrationError(409,'release_notes_conflict','The release or its notes changed. Reload before saving again.');
  }
  throw error;
 }
 return readReleaseNotes(db,actor,id);
}
export async function generateNotes(db:D1Database,actor:string,id:string,input:z.infer<typeof generateReleaseNotes>){
 const {release,canEdit}=await context(db,actor,id);writable(release,canEdit,input.expectedReleaseVersion);
 const existing=await stored(db,id);
 if(existing){await visibleSources(db,existing,release);throw new IntegrationError(409,'release_draft_exists','Edit the saved draft; generation never replaces it.');}
 const sourcesJson=(await db.prepare(sourceSnapshot).bind(id).first<string>('snapshot'))!,sources=JSON.parse(sourcesJson) as NoteSource[];
 if(!sources.length)throw new IntegrationError(409,'no_completed_issues','Complete an issue in this release before drafting notes.');
 const body=draftMarkdown(sources);
 if(body.length>100000)throw new IntegrationError(413,'release_notes_too_large','The drafted notes are too long to save.');
 return save(db,actor,release,sourcesJson,body,1);
}
export async function editNotes(db:D1Database,actor:string,id:string,input:z.infer<typeof editReleaseNotes>){
 const {release,canEdit}=await context(db,actor,id);writable(release,canEdit,input.expectedReleaseVersion);
 const row=await stored(db,id);if(!row)throw unavailable();
 await visibleSources(db,row,release);
 if(row.version!==input.expectedVersion)throw new IntegrationError(409,'stale_release_notes','The notes changed. Reload before saving again.');
 return save(db,actor,release,row.sourcesJson,input.body,row.version+1,row.sourceReleaseVersion);
}
