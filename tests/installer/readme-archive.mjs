import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readArchive,canonicalJson} from '@runeditrun/rer/modules/portability';

export async function populateArchive(page,origin) {
 const admin=await page.request.get(origin+'/api/settings/administration');assert.equal(admin.status(),200);
 const team=(await admin.json()).teams[0],status=team.statuses.find(row=>row.category==='unstarted');
 const created=await page.request.post(origin+'/api/issues',{headers:{Origin:origin},data:{teamId:team.id,statusId:status.id,title:'README archive',description:'Retained through the public commands'}});
 assert.equal(created.status(),201);const issue=await created.json();
 const commented=await page.request.post(origin+'/api/issues/'+issue.identifier+'/comments',{headers:{Origin:origin},data:{body:'Searchable restored comment'}});assert.equal(commented.status(),201);
 for(const [name,type,bytes] of [['plain.txt','text/plain',Buffer.from('Original bytes')],['record.json','application/json',Buffer.from('{"retained":true}')]]) {
  const uploaded=await page.request.post(origin+'/api/issues/'+issue.identifier+'/files',{headers:{Origin:origin,'Content-Type':type,'X-File-Name':name},data:bytes});assert.equal(uploaded.status(),201);
 }
 return issue.identifier;
}
export async function compareArchives(root,first,second) {
 const read=async name=>{const bytes=await readFile(join(root,name)),records=[];for await(const record of readArchive(new Response(bytes).body))records.push(record);return records;};
 const before=await read(first),after=await read(second);
 assert.equal(before.at(-1).contentHash,after.at(-1).contentHash);
 assert.deepEqual(before.filter(row=>row.kind==='part').flatMap(row=>row.items).map(canonicalJson),after.filter(row=>row.kind==='part').flatMap(row=>row.items).map(canonicalJson));
 assert.equal(before[0].objects.length,2);assert.equal(after[0].objects.length,2);
 return {objects:2,rows:before[0].tables.reduce((sum,table)=>sum+table.count,0),semanticEquality:true};
}
