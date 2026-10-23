import {z} from 'zod';
import {IntegrationError} from '../errors';
import {githubReferences,githubReferenceKind} from './input';
import {githubDelivery,type GithubDelivery} from './delivery';
import {gitGuard,gitMove} from './rules';
export const gitSha=z.string().regex(/^[a-f0-9]{40}$/i).transform(s=>s.toLowerCase());
export const pushPayload=z.object({
 ref:z.string().max(1024),before:gitSha.optional(),after:gitSha.optional(),forced:z.boolean().optional(),deleted:z.boolean().optional(),
 repository:z.object({full_name:z.string().min(1).max(200),default_branch:z.string().min(1).max(1024)}),
 commits:z.array(z.object({id:gitSha,message:z.string().max(100000),url:z.string().max(2000),author:z.object({name:z.string().min(1).max(300)})})).max(200),
});
export function githubCommitUrl(value:string,repository:string,sha:string){
 let url;try{url=new URL(value);}catch{throw new IntegrationError(400,'invalid_commit_url');}
 if(url.origin!=='https://github.com'||url.username||url.password||url.search||url.hash||url.pathname.toLowerCase()!=='/'+repository+'/commit/'+sha)throw new IntegrationError(400,'invalid_commit_url');
 return url.href;
}
export async function receivePush(raw:unknown,context:GithubDelivery,extra?:(input:z.infer<typeof pushPayload>,at:string)=>Promise<D1PreparedStatement[]>){
 const parsed=pushPayload.safeParse(raw);if(!parsed.success)throw new IntegrationError(400,'invalid_github_push');
 const input=parsed.data;if(input.repository.full_name.toLowerCase()!==context.repository)throw new IntegrationError(400,'github_repository_mismatch');
 if(!input.ref.startsWith('refs/heads/'))throw new IntegrationError(400,'invalid_github_push_ref');
 return githubDelivery(context,async()=>{
  const {db,id,workspace,repository}=context,at=new Date().toISOString(),statements:D1PreparedStatement[]=[],closing=new Set<string>();let linked=0;
  if(!input.deleted)for(const commit of input.commits){
   const url=githubCommitUrl(commit.url,repository,commit.id),subject=commit.message.split(/\r?\n/)[0]!;
   if(subject.length>2000)throw new IntegrationError(413,'github_commit_subject_limit');
   const refs=githubReferences(commit.message);if(refs.length>20)throw new IntegrationError(413,'github_reference_limit');
   const issues=(await db.prepare('SELECT i.id,i.identifier,i.version FROM issues i JOIN teams t ON t.id=i.team_id WHERE t.workspace_id=? AND i.identifier IN (SELECT value FROM json_each(?))').bind(workspace,JSON.stringify(refs)).all<{id:string;identifier:string;version:number}>()).results;
   for(const issue of issues){
    if(++linked>200)throw new IntegrationError(413,'github_link_limit');
    const previous=await db.prepare('SELECT author,subject,url,closing_applied FROM github_commit_links WHERE repository_id=? AND sha=? AND issue_id=?').bind(id,commit.id,issue.id).first<{author:string;subject:string;url:string;closing_applied:number}>();
    if(previous&&(previous.author!==commit.author.name||previous.subject!==subject||previous.url!==url))throw new IntegrationError(409,'github_commit_conflict');
    const closes=input.ref==='refs/heads/'+input.repository.default_branch&&githubReferenceKind(issue.identifier,commit.message)==='closes';
    statements.push(gitGuard(db,'EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=? AND i.version=? AND t.workspace_id=?)',issue.id,issue.version,workspace),
     db.prepare('INSERT INTO github_commit_links(repository_id,sha,issue_id,author,subject,url,closing_applied,received_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(repository_id,sha,issue_id) DO UPDATE SET closing_applied=MAX(github_commit_links.closing_applied,excluded.closing_applied)').bind(id,commit.id,issue.id,commit.author.name,subject,url,Number(closes),at));
    if(closes&&!previous?.closing_applied)closing.add(issue.id);
   }
  }
  for(const issue of closing)statements.push(...await gitMove(db,issue,'merged',at));
  if(extra)statements.push(...await extra(input,at));
  return {statements,linked,diagnostic:input.deleted?'deleted_branch_recorded':linked?'commits_linked':'no_issue_reference'};
 });
}
