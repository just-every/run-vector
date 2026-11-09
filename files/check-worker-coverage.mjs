import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const repo=process.argv[2], packet=new URL('.',import.meta.url).pathname;
const require=createRequire(join(repo,'package.json'));
const {BaseSequencer}=await import(pathToFileURL(require.resolve('vitest/node')));
const plan=JSON.parse(readFileSync(join(packet,'plan-after.json')));
const before=JSON.parse(readFileSync(join(packet,'plan-before.json')));
const commands=p=>Object.entries(p.verificationShards).flatMap(([row,p])=>p.commands.filter(c=>Array.isArray(c)&&c[0]==='test:worker').map(c=>({row,command:c})));
assert.deepEqual(commands(before),commands(plan));
const all=JSON.parse(readFileSync('/tmp/vector-worker-files-all.json')).map(r=>r.file);
const inventory=[];
for(const [i,{row,command}] of commands(plan).entries()) {
 const outfile='/tmp/vector-worker-selection-'+i+'.json';
 const args=command.slice(1).filter(s=>!s.startsWith('--shard='));
 execFileSync('pnpm',['exec','vitest','list','--config','vitest.config.ts','--filesOnly','--json='+outfile,...args],{cwd:repo,stdio:'pipe',timeout:180000});
 let specs=JSON.parse(readFileSync(outfile)).map(r=>({moduleId:r.file}));
 const shard=command.find(s=>s.startsWith('--shard='));
 if(shard) {
  const [index,count]=shard.slice(8).split('/').map(Number);
  specs=await new BaseSequencer({config:{root:repo,shard:{index,count}}}).shard(specs);
 }
 inventory.push({row,command,count:specs.length,files:specs.map(s=>relative(repo,s.moduleId))});
}
const files=inventory.flatMap(i=>i.files);
assert.deepEqual([...files].sort(),all.map(f=>relative(repo,f)).sort());
assert.equal(new Set(files).size,files.length);
const report={passed:true,beforeFileCount:all.length,afterFileCount:files.length,duplicates:[],omissions:[],workerCommandsUnchanged:true,method:'Vitest list --filesOnly discovers candidates but bypasses sharding. Apply the installed Vitest BaseSequencer.shard to the exact post-exclusion candidate set, as its execution pool does.',inventory};
writeFileSync(join(packet,'worker-coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log('worker coverage before='+all.length+' after='+files.length+' duplicates=0 omissions=0; row partition sizes='+inventory.map(i=>i.count));
