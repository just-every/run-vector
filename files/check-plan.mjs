import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {join,dirname} from 'node:path';
const repo=process.argv[2];
const packet=dirname(new URL(import.meta.url).pathname);
const before=JSON.parse(readFileSync(join(packet,'plan-before.json')));
const after=JSON.parse(readFileSync(join(packet,'plan-after.json')));
const original=execFileSync('git',['show','55d6f915ff823e06f674376500e3e4deb6d2d8fa:scripts/verification-plan.mjs'],{cwd:repo,encoding:'utf8'});
const old=await import('data:text/javascript;base64,'+Buffer.from(original).toString('base64'));
const current=await import(pathToFileURL(join(repo,'scripts/verification-plan.mjs')));
assert.deepEqual(current.ciCommands,old.ciCommands);
assert.deepEqual(current.buildCommands,old.buildCommands);
const rows=Object.keys(before.verificationShards);
assert.deepEqual(Object.keys(after.verificationShards),rows);
for(const row of rows.filter(r=>!['administration','worker-heavy'].includes(r))) {
 assert.deepEqual(after.verificationShards[row],before.verificationShards[row]);
}
const b=before.verificationShards,a=after.verificationShards;
assert.deepEqual(a.administration.commands,b.administration.commands.slice(0,2));
assert.deepEqual(a['worker-heavy'].commands,[...b['worker-heavy'].commands,'build',...b.administration.commands.slice(2)]);
const tests=plans=>Object.values(plans).flatMap(p=>p.commands).filter(c=>c!=='build').map(c=>JSON.stringify(c)).sort();
assert.deepEqual(tests(a),tests(b));
assert.equal(new Set(tests(a)).size,tests(a).length);
const effective=plan=>Object.entries(plan.verificationShards).flatMap(([row,p])=>p.commands.filter((c,i)=>!(plan.verificationMatrix.find(m=>m.shard===row).prebuilt && i===p.commands.indexOf('build'))).map(c=>JSON.stringify(c))).sort();
assert.deepEqual(effective(before),effective(after));
const matrix=after.verificationMatrix.find(m=>m.shard==='worker-heavy');
assert.deepEqual(matrix,{shard:'worker-heavy',browser:true,native:false,prebuilt:true});
for(const row of rows.filter(r=>r!=='worker-heavy'))assert.deepEqual(after.verificationMatrix.find(m=>m.shard===row),before.verificationMatrix.find(m=>m.shard===row));
const report={
 passed:true, beforeRows:rows.length, afterRows:rows.length,
 beforeNonBuildCommands:tests(b).length,afterNonBuildCommands:tests(a).length,
 nonBuildCommandDuplicates:0,effectiveCommandsBefore:effective(before).length,effectiveCommandsAfter:effective(after).length,
 effectiveCommandMultisetEqual:true, serialCommandsUnchanged:true, buildCommandsUnchanged:true,
 moved:b.administration.commands.slice(2), unchangedRows:rows.filter(r=>!['administration','worker-heavy'].includes(r)),
 note:'An extra build marker on worker-heavy requests this exact SHA shared artifact. Both ordinary-row initial build markers are skipped by verify.mjs; actual CI command multiset is identical. Hosted-artifact fresh builds remain unchanged.',
};
writeFileSync(join(packet,'plan-coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
