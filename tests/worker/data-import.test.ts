import { env } from 'cloudflare:workers';
import { expect,it } from 'vitest';
import { Buffer } from 'node:buffer';
import { setupImport } from './data-import-fixture';
import { request } from './base-auth-fixture';
it('[DATA-002 DATA-004] reviewed native JSON and CSV retain times, relationships and originals; repeats reuse and native edits refuse',async()=>{
 const f=await setupImport();
 expect((await f.call('/settings/integrations/destinations','POST',{name:'Import effect proof',url:'https://receiver.example.com/events'})).status).toBe(201);
 const before=await f.effects();
 const value=f.input([f.row('child',{parent:'source:parent',dependencies:'source:parent'}),f.row('parent')]);
 const job=await f.publish(value);expect(job.state).toBe('completed');expect(job.checkpoint).toBe(2);
 const rows=(await env.DB.prepare('SELECT id,title,identifier,version,created_at,updated_at FROM issues ORDER BY identifier').all()).results;
 expect(rows.map(row=>row.title)).toEqual(['Imported parent','Imported child']);
 for(const row of rows){expect(row.version).toBe(1);expect(row.created_at).toBe('2026-09-01T01:02:03.000Z');expect(row.updated_at).toBe('2026-09-02T04:05:06.000Z');}
 expect((await env.DB.prepare('SELECT parent_issue_id FROM issue_parents WHERE issue_id=?').bind(rows[1].id).first())?.parent_issue_id).toBe(rows[0].id);
 expect((await env.DB.prepare('SELECT blocking_issue_id FROM issue_dependencies WHERE blocked_issue_id=?').bind(rows[1].id).first())?.blocking_issue_id).toBe(rows[0].id);
 expect((await env.DB.prepare('SELECT count(*) n FROM issue_activity WHERE kind=?').bind('issue.imported').first())?.n).toBe(2);
 const originals=await (await f.call('/data/import/runs/'+job.id+'/originals')).json() as {name:string;original:{base64:string}}[];
 expect(originals.find(row=>row.name==='issues.json')?.original.base64).toBe(value.base64);
 expect((await f.publish(value)).id).toBe(job.id);expect((await env.DB.prepare('SELECT count(*) n FROM issues').first())?.n).toBe(2);
 const reviewed=await f.preview(value);expect(reviewed.measured.reused).toBe(2);
 const reusedRun=await f.apply(value,reviewed,'different-operation');expect(reusedRun.status).toBe(200);expect((await f.finish(await reusedRun.json())).state).toBe('completed');
 expect((await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE action='issues.imported'").first())?.n).toBe(1);
 const csv='\uFEFFid,title,description,team,status,priority,created,updated,parent,dependencies\r\ncsv,"Quoted, issue","First line\nUnicode café and ""quotes""",'+f.team.name+','+f.status.name+',high,2026-09-01T01:02:03.000Z,2026-09-02T04:05:06.000Z,,\r\n';
 const csvInput={...f.input([], 'csv-fixture'),format:'csv' as const,name:'issues.csv',base64:Buffer.from(csv).toString('base64')};await f.publish(csvInput);
 expect((await env.DB.prepare('SELECT description FROM issues WHERE title=?').bind('Quoted, issue').first())?.description).toBe('First line\nUnicode café and "quotes"');
 expect(await f.effects()).toEqual(before);expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 expect((await request('/api/data/import/runs')).status).toBe(401);
 await env.DB.prepare('UPDATE issues SET title=?,version=version+1 WHERE id=?').bind('Native edit',rows[0].id).run();
 const edited=await f.preview(value);expect(edited.ready).toBe(false);expect(edited.errors.some(row=>row.code==='native_edit_conflict')).toBe(true);
 expect((await f.call('/data/import/runs/'+job.id+'/rollback','POST',{confirmed:true})).status).toBe(409);
 expect((await env.DB.prepare('SELECT title FROM issues WHERE id=?').bind(rows[0].id).first())?.title).toBe('Native edit');
},180_000);
it('[DATA-002 DATA-003] every invalid row and reused source conflict is reviewed before publication, with exact SQL and row bounds',async()=>{
 const f=await setupImport(),value=f.input([f.row('bad-title',{title:''}),f.row('bad-assignee',{assignee:'uninvited@example.test'}),f.row('bad-date',{created:'yesterday'}),f.row('bad-parent',{parent:'missing'}),f.row('duplicate'),f.row('duplicate',{title:'Changed duplicate'})]);
 value.mapping.assignee='assignee';const review=await f.preview(value);
 const before=(await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results;
 expect(review.ready).toBe(false);expect([...new Set(review.errors.filter(row=>row.row>0).map(row=>row.row))].sort()).toEqual([1,3,4,5,6]);
 // Someone who is not an operator does not block the run: the issue lands unassigned and the review names the row.
 expect(review.omissions.filter(row=>row.code==='unresolved_assignee').map(row=>row.row)).toEqual([2]);
 expect((await f.apply(value,review)).status).toBe(400);expect((await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results).toEqual(before);
 const valid=f.input([f.row('stable')]);await f.publish(valid);
 const changed=f.input([f.row('stable',{title:'Changed source'})]);expect((await f.preview(changed)).errors.some(row=>row.code==='source_content_conflict')).toBe(true);
 const tooMany=f.input(Array.from({length:review.bounds.rows+1},(_,i)=>f.row('row-'+i)),'too-many');expect((await f.call('/data/import/preview','POST',tooMany)).status).toBe(413);
 const corrupt={...valid,base64:Buffer.from('[{"id":"x","id":"y"}]').toString('base64')};expect((await f.call('/data/import/preview','POST',corrupt)).status).toBe(400);
 const reviewed=await f.preview(f.input([f.row('next')],'new-source'));expect(reviewed.measured.nativeStatements).toBeGreaterThan(0);expect(reviewed.measured.maxParameters).toBeGreaterThan(0);
 expect((await f.apply(f.input([f.row('next',{title:'Changed after review'})],'new-source'),reviewed)).status).toBe(409);
 expect((await env.DB.prepare('SELECT count(*) n FROM issues').first())?.n).toBe(before.length+1);
},180_000);
