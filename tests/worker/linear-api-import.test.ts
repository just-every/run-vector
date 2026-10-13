import { env } from 'cloudflare:workers';
import { expect,it } from 'vitest';
import { Buffer } from 'node:buffer';
import { setupLinearWorkspace } from './linear-workspace-fixture';
import type { ImportInput } from '../../src/core/features/data/import/types';

const count=async(sql:string,...params:unknown[])=>(await env.DB.prepare(sql).bind(...params).first<number>('n'))??0;
const tables=async()=>Object.fromEntries(await Promise.all((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' AND name NOT IN ('access_rate_limits','oa_limits') ORDER BY name").all<{name:string}>()).results.map(async({name})=>[name,await count(`SELECT count(*) AS n FROM "${name}"`)])));
it('[DATA-008] a Linear CSV and API file pair imports comments with original times and authors, safe links, dependencies and duplicates with no outbound effect; a malformed file is refused row by row',async()=>{
 const f=await setupLinearWorkspace(60);
 expect((await f.call('/settings/integrations/destinations','POST',{name:'Import effect proof',url:'https://receiver.example.com/events'})).status).toBe(201);
 const generated=f.workspace(80,11,3),api=generated.api.issues;
 const pair=(file=api,source='linear-api'):ImportInput=>({...f.input(generated.csv,source),format:'linear-api-json',api:{name:'linear-api.json',base64:Buffer.from(JSON.stringify({issues:file})).toString('base64')}});
 const before={effects:await f.effects(),mail:await count('SELECT count(*) AS n FROM rer_mail_development_outbox')};
 const value=pair(),review=await f.preview(value);
 expect(review.errors).toEqual([]);expect(review.ready).toBe(true);
 let run=await f.createRun(value,review);while(run.progress.unfinished)run=await f.resume(run);expect(run.state).toBe('completed');
 const issueOf=async(sourceId:string)=>(await env.DB.prepare("SELECT i.id,i.identifier FROM ik_provenance p JOIN issues i ON i.id=p.target_id WHERE p.job_id=? AND json_extract(p.record_json,'$.sourceId')=?").bind(run.id,sourceId).first<{id:string;identifier:string}>())!;
 // Comments keep their original time and author's name; no operator is created.
 const comments=api.flatMap(node=>node.comments.nodes.map(comment=>({...comment,sourceId:node.identifier})));expect(comments.length).toBeGreaterThan(0);
 expect(await count('SELECT count(*) AS n FROM issue_comments WHERE imported_author_name IS NOT NULL')).toBe(comments.length);
 const sample=comments[0],target=await issueOf(sample.sourceId);
 expect(await env.DB.prepare('SELECT body,created_at,imported_author_name FROM issue_comments WHERE issue_id=? ORDER BY created_at LIMIT 1').bind(target.id).first()).toEqual({body:sample.body,created_at:sample.createdAt,imported_author_name:sample.user.displayName});
 const discussion=await (await f.call('/issues/'+target.identifier+'/discussion')).json() as {comments:{actor:string;imported:unknown}[]};
 expect(discussion.comments[0]).toMatchObject({actor:sample.user.displayName});expect(Boolean(discussion.comments[0].imported)).toBe(true);
 expect(await count("SELECT count(*) AS n FROM operators WHERE name='Former Teammate'")).toBe(0);
 // Attachment links become named HTTPS links; dependencies and duplicates link issues of the run.
 const links=api.flatMap(node=>node.attachments.nodes.map(link=>({...link,sourceId:node.identifier})));
 for(const link of links)expect(await env.DB.prepare('SELECT name,url FROM issue_links WHERE issue_id=? AND name=?').bind((await issueOf(link.sourceId)).id,link.title).first()).toEqual({name:link.title,url:link.url});
 const blocks=api.flatMap(node=>node.relations.nodes.filter(relation=>relation.type==='blocks').map(relation=>[node.identifier,relation.relatedIssue.identifier]));
 expect(blocks.length).toBeGreaterThan(0);
 for(const [blocker,blocked] of blocks)expect(await count('SELECT count(*) AS n FROM issue_dependencies WHERE blocking_issue_id=? AND blocked_issue_id=?',(await issueOf(blocker)).id,(await issueOf(blocked)).id)).toBe(1);
 const duplicates=api.flatMap(node=>node.relations.nodes.filter(relation=>relation.type==='duplicate').map(relation=>[node.identifier,relation.relatedIssue.identifier]));
 expect(duplicates.length).toBe(3);
 for(const [copy,canonical] of duplicates)expect(await count("SELECT count(*) AS n FROM issue_links WHERE issue_id=? AND name=?",(await issueOf(copy)).id,'Duplicate of '+(await issueOf(canonical)).identifier)).toBe(1);
 // The report says attachment bytes were never in the file; nothing left Vector.
 const report=await (await f.call('/data/import/runs/'+run.id+'/report')).json() as {notInFile:string[]};
 expect(report.notInFile.join(' ')).toContain('attachment file bytes');
 expect(await f.effects()).toEqual(before.effects);expect(await count('SELECT count(*) AS n FROM rer_mail_development_outbox')).toBe(before.mail);
 // A malformed file: an unsafe link scheme, an unknown source ID, and a comment for an issue outside the run.
 const malformed=structuredClone(api);
 malformed[4].attachments.nodes.push({title:'Script',url:'javascript:alert(1)'});
 malformed.push({identifier:'ENG-9999',parent:null,comments:{nodes:[]},attachments:{nodes:[]},relations:{nodes:[]}});
 malformed.push({identifier:'OPS-8888',parent:null,comments:{nodes:[{body:'Outside the run',createdAt:'2025-02-01T00:00:00.000Z',user:{displayName:'Owner'}}]},attachments:{nodes:[]},relations:{nodes:[]}});
 const bad=pair(malformed,'linear-api-bad'),badReview=await f.preview(bad),snapshot=await tables();
 expect(badReview.ready).toBe(false);
 const row4=generated.rows.findIndex(row=>row.ID===malformed[4].identifier);
 expect(badReview.errors.find(error=>error.code==='unsafe_link')).toMatchObject({row:expect.any(Number),field:'api attachments'});
 expect(badReview.errors.filter(error=>error.code==='unsafe_link')).toHaveLength(1);expect(row4).toBeGreaterThanOrEqual(0);
 expect(badReview.errors.find(error=>error.code==='api_unknown_source')?.message).toContain('ENG-9999');
 expect(badReview.errors.find(error=>error.code==='api_comment_outside_run')?.message).toContain('OPS-8888');
 expect((await f.apply(bad,review)).status).toBe(400);
 expect(await tables()).toEqual(snapshot);
},600_000);
