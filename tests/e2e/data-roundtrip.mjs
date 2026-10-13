import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,stat,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {populateIntegrationHistory,verifyIntegrationCategories,verifyRestoredIntegrations} from './data-integration-history.mjs';
import {dataInstallation} from './data-installation.mjs';
import {populateRoundtrip,verifyRoundtripCategories} from './data-roundtrip-fixture.mjs';
import {readArchive,canonicalJson} from '@runeditrun/rer/modules/portability';
const work=await mkdtemp(join(tmpdir(),'vector-roundtrip-')),evidence=resolve('evidence/data');let source,destination;
const proof={passed:false,independentInstallations:true,commands:[],categories:[],rows:0,objects:0,equality:false,heldAfterCron:false,privateViews:false};
const records=async path=>{const result=[];for await(const row of readArchive(new Response(await readFile(path)).body))result.push(row);return result;};
try{
 await mkdir(evidence,{recursive:true});source=await dataInstallation(work,'source');destination=await dataInstallation(work,'destination');await source.configure(true);await source.start();const cookie=await source.signIn();
 const fixture=await populateRoundtrip(source,cookie);const integrations=await populateIntegrationHistory(source,cookie,fixture.identifier);await source.stop();
 // rer keeps archives in the unserved exports/ folder.
 const first=join(source.root,'exports/first.jsonl'),repeat=join(source.root,'exports/repeat.jsonl'),input=join(destination.root,'input.jsonl'),second=join(destination.root,'exports/second.jsonl');
 await source.run('Export source archive',['export','--','--target','local','--output','exports/first.jsonl','--non-interactive']);proof.commands.push('pnpm run export -- --target local');
 assert.equal((await stat(first)).mode&0o777,0o600);await source.run('Repeat export without changing product',['export','--','--target','local','--output','exports/repeat.jsonl','--non-interactive']);const repeated=await records(repeat),original=await records(first);assert.equal(repeated.at(-1).contentHash,original.at(-1).contentHash);assert.deepEqual(repeated.filter(row=>row.kind==='part').flatMap(row=>row.items),original.filter(row=>row.kind==='part').flatMap(row=>row.items));
 await copyFile(first,input);assert.equal((await stat(input)).mode&0o777,0o600);
 await destination.run('Import into independent empty installation',['import','--','--target','local','--input','input.jsonl','--yes','--non-interactive']);proof.commands.push('pnpm run import -- --target local');
 await destination.run('Export independent restored archive',['export','--','--target','local','--output','exports/second.jsonl','--non-interactive']);proof.commands.push('pnpm run export -- --target local');
 const before=await records(first),after=await records(second);assert.equal(before.at(-1).contentHash,after.at(-1).contentHash);assert.deepEqual(before.filter(row=>row.kind==='part').flatMap(row=>row.items).map(canonicalJson),after.filter(row=>row.kind==='part').flatMap(row=>row.items).map(canonicalJson));
 proof.categories=[...verifyRoundtripCategories(before),...verifyIntegrationCategories(before)];proof.rows=before[0].tables.reduce((sum,row)=>sum+row.count,0);proof.objects=before[0].objects.length;assert.equal(proof.objects,2);proof.equality=true;
 assert.deepEqual(destination.sql('PRAGMA foreign_key_check'),[]);await destination.configure();await destination.start();const restored=await destination.signIn();
 assert.equal((await destination.req('/api/issues/'+fixture.identifier,'GET',undefined,restored)).status,200);
 const search=await destination.req('/api/search?q=searchable','GET',undefined,restored);assert.equal(search.status,200);assert((await search.json()).issues.some(row=>row.identifier===fixture.identifier),'Restored comments resolve to their native issue');
 const exact=await destination.req('/api/search?q='+encodeURIComponent(fixture.identifier),'GET',undefined,restored);assert.equal(exact.status,200);assert((await exact.json()).issues.some(row=>row.identifier===fixture.identifier),'Restored immutable identifiers remain searchable');
 assert.equal((await destination.req('/auth/request','POST',{email:'maya@vector.test'})).status,409);
 assert.equal((await destination.req('/api/data/restore/operators/'+fixture.peer,'POST',{},restored)).status,200);const peer=await destination.signIn('maya@vector.test');
 assert.equal((await destination.req('/api/views/'+fixture.privateView,'GET',undefined,peer)).status,404);assert.equal((await destination.req('/api/views/'+fixture.sharedView,'GET',undefined,peer)).status,200);proof.privateViews=true;
 assert.equal((await destination.req('/cdn-cgi/local/scheduled')).status,404);
 const runCron=()=>destination.scheduledRun();
 const history=destination.sql('SELECT * FROM notification_deliveries ORDER BY id'),attempts=destination.sql('SELECT * FROM notification_delivery_attempts ORDER BY id');
 await runCron();assert.deepEqual(destination.sql('SELECT * FROM notification_deliveries ORDER BY id'),history);assert.deepEqual(destination.sql('SELECT * FROM notification_delivery_attempts ORDER BY id'),attempts);
 await verifyRestoredIntegrations(destination,restored,integrations,fixture.identifier);await runCron();assert.deepEqual(destination.sql('SELECT * FROM notification_deliveries ORDER BY id'),history);assert.deepEqual(destination.sql('SELECT * FROM notification_delivery_attempts ORDER BY id'),attempts);proof.heldAfterCron=true;
 await destination.stop();proof.passed=true;
}finally{await source?.close();await destination?.close();await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'roundtrip-proof.json'),JSON.stringify(proof,null,2)+'\n');await rm(work,{recursive:true,force:true});}
console.log('Independent native installations: complete public archive command equality, restored privacy and no historical Cron replay passed.');
