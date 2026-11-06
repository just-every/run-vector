import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root = process.cwd(), base = execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim();
const {parseContract} = await import(pathToFileURL(root+'/src/base/seed-contract.mjs'));
const prior = execFileSync('git',['show',base+':CONTRACT.md'],{encoding:'utf8'}), current = fs.readFileSync('CONTRACT.md','utf8');
const before = parseContract(prior), after = parseContract(current);
const addition = current.match(/^#### AUTO-007 — Private occurrence history after access changes\n[\s\S]*?(?=^### Reporting\n)/m)?.[0];
assert.ok(addition);
assert.match(addition,/\*Tier:\* Core · \*From:\* new/);
assert.deepEqual([...addition.matchAll(/^(\d)\. /gm)].map(m=>+m[1]),[1,2,3,4]);
const row = current.split('\n').find(l=>l.startsWith('| `AUTO-007` |'));
const cells = row.split('|').slice(1,-1).map(c=>c.trim());
assert.equal(cells[2],'target'); assert.equal(cells[3],'missing'); assert.equal(cells[4],''); assert.ok(cells[5]);
let normalized = current.replace(addition,'').replace(row+'\n','');
for (const label of ['Published','Target and push further','All']) {
 const old = prior.split('\n').find(l=>l.startsWith('| '+label+' |'));
 const generated = normalized.split('\n').find(l=>l.startsWith('| '+label+' |'));
 normalized = normalized.replace(generated,old);
}
normalized = normalized.replace(/Accepted DONE is \d+ of \d+/g,prior.match(/Accepted DONE is \d+ of \d+/)[0]);
assert.equal(normalized,prior,'Every pre-existing byte apart from generated counts must be retained');
assert.equal(before.clauses.length,272); assert.equal(after.clauses.length,273);
assert.deepEqual(after.counts,{...before.counts,missing:before.counts.missing+1,total:before.counts.total+1});
for(const clause of before.clauses) {
 const next = after.clauses.find(c=>c.id===clause.id); assert.ok(next);
 for(const key of ['id','title','kind','status','evidence','gap','text']) assert.deepEqual(next[key],clause[key],clause.id+' '+key);
}
const knownIds=[...new Set([...prior.matchAll(/\bAUTO-\d+\b/g)].map(m=>m[0]))].sort();
assert.equal(knownIds.at(-1),'AUTO-006');
const r=fs.readFileSync('RULINGS.md','utf8');
assert.deepEqual([...r.matchAll(/^### (RL-\d+) — /gm)].map(m=>m[1]),['RL-101']);
for(const name of ['ACCEPTANCE.md','docs/CLAIMS.md']) assert.deepEqual(fs.readFileSync(name),execFileSync('git',['show',base+':'+name]));
const tally=list=>({done:list.filter(c=>c.status==='done').length,partial:list.filter(c=>c.status==='partial').length,missing:list.filter(c=>c.status==='missing').length,total:list.length});
const tiers=p=>({core_legacy_unmarked:tally(p.clauses.filter(c=>!c.id.startsWith('BASE-AGENT-')&&!/\*Tier:\* (?:Later|Agent surface)/.test(c.text))),agent_surface:tally(p.clauses.filter(c=>c.id.startsWith('BASE-AGENT-')||/\*Tier:\* Agent surface/.test(c.text))),later:tally(p.clauses.filter(c=>/\*Tier:\* Later/.test(c.text)))});
const receipt={result:'PASS',main_base:base,before:before.counts,after:after.counts,tiers_before:tiers(before),tiers_after:tiers(after),all_272_definitions_and_full_status_rows_unchanged:true,entire_old_contract_restored_by_removing_only_addition_and_reversing_generated_counts:true,homepage_claims_and_judged_provenance_unchanged:true,auto001_status_row:current.split('\n').find(l=>l.startsWith('| `AUTO-001` |')),added:'AUTO-007',ruling:'RL-101',acceptance_points:4,new_evidence:'',generated_views_restored:true,normalized_contract_sha256:createHash('sha256').update(normalized).digest('hex')};
fs.writeFileSync('../packet/contract-preservation.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
