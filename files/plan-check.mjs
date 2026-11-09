import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { relative } from 'node:path';
const root = process.cwd();
const packet = `${process.env.HOME}/rer-consolidation/work/sd-vector-ci-shape-1/packet`;
const beforeSource = execFileSync('git', ['show', 'origin/main:scripts/verification-plan.mjs'], { encoding: 'utf8' });
await writeFile('/tmp/vector-original-plan.mjs', beforeSource);
const before = await import(pathToFileURL('/tmp/vector-original-plan.mjs'));
const after = await import(pathToFileURL(`${root}/scripts/verification-plan.mjs`));
assert.deepEqual(after.buildCommands, before.buildCommands);
assert.deepEqual(after.ciCommands, before.ciCommands);
const beforeLists = JSON.parse(await readFile(`${packet}/partitions-before.json`, 'utf8')).rows;
const afterLists = JSON.parse(await readFile(`${packet}/partitions-after.json`, 'utf8')).rows;
const workerCommands = Object.entries(after.verificationShards).flatMap(([row, plan]) =>
  plan.commands.filter(command => Array.isArray(command) && command[0] === 'test:worker').map(command => ({row, command})));
const dedicated = workerCommands.find(entry => entry.row === 'worker-heavy');
assert(dedicated);
const heavy = dedicated.command.slice(1);
assert.deepEqual(heavy, ['tests/worker/role-matrix.test.ts', 'tests/worker/data-http-audit-recovery.test.ts']);
const { createVitest } = await import(pathToFileURL(`${root}/node_modules/vitest/dist/node.js`));
const ctx = await createVitest('test', { config: 'vitest.config.ts', watch: false });
let heavyFiles;
try { heavyFiles = (await ctx.globTestSpecifications(heavy)).map(spec => relative(root, spec.moduleId)).sort(); }
finally { await ctx.close(); }
assert.deepEqual(heavyFiles, [...heavy].sort());
afterLists['worker-heavy'] = heavyFiles;
const flatten = rows => Object.values(rows).flat();
const allBefore = flatten(beforeLists);
const allAfter = flatten(afterLists);
assert.equal(new Set(allBefore).size, allBefore.length);
assert.equal(new Set(allAfter).size, allAfter.length);
assert.deepEqual([...allAfter].sort(), [...allBefore].sort());
assert.equal(allAfter.length, 119);
const seenPartitions = new Set();
for (const {row, command} of workerCommands.filter(entry => entry.row !== 'worker-heavy')) {
  assert.equal(command.length, 4);
  assert.match(command[1], /^--shard=[1-6]\/6$/);
  assert(!seenPartitions.has(command[1]));
  seenPartitions.add(command[1]);
  assert.deepEqual(command.slice(2), heavy.map(file => `--exclude=${file}`));
}
assert.equal(seenPartitions.size, 6);
for (const [row, plan] of Object.entries(before.verificationShards)) {
  assert(after.verificationShards[row]);
  const ordinary = commands => commands.filter(command => !Array.isArray(command) || command[0] !== 'test:worker');
  assert.deepEqual(ordinary(after.verificationShards[row].commands), ordinary(plan.commands));
  for (const flag of ['browser', 'native']) assert.equal(after.verificationShards[row][flag], plan[flag]);
}
assert.deepEqual(after.verificationMatrix.filter(row => row.shard !== 'worker-heavy'), before.verificationMatrix);
assert.deepEqual(after.verificationMatrix.find(row => row.shard === 'worker-heavy'), {shard:'worker-heavy', browser:false, native:false, prebuilt:false});
const workflow = await readFile(`${root}/.github/workflows/verify.yml`, 'utf8');
assert.equal(workflow, execFileSync('git', ['show', 'origin/main:.github/workflows/verify.yml'], {encoding:'utf8'}));
assert(workflow.includes('include: ${{ fromJSON(needs.plan.outputs.matrix) }}'));
assert(workflow.includes('needs: [plan, build, shards]'));
assert(workflow.includes('for result in $RESULTS; do test "$result" = success; done'));
assert(workflow.includes('timeout-minutes: 25'));
const output = {passed:true, beforeFiles:allBefore.length, afterFiles:allAfter.length, duplicates:0,
  omitted:0, added:0, beforeRows:before.verificationMatrix.length, afterRows:after.verificationMatrix.length,
  dedicatedFiles:heavyFiles, beforePerPartition:Object.fromEntries(Object.entries(beforeLists).map(([key,files])=>[key,files.length])),
  afterPerPartition:Object.fromEntries(Object.entries(afterLists).map(([key,files])=>[key,files.length])),
  assertions:['actual Vitest configured sequencer file union unchanged', 'exactly-once full worker/installer file coverage', 'exact actual dedicated filter selection', 'all six partition invocations exclude dedicated files', 'serial command wall unchanged', 'all existing non-worker commands and flags unchanged', 'new matrix flags false/false/false', 'unchanged dynamic workflow, 25-minute job cap and aggregate verify guard'],
  matrix:after.verificationMatrix};
await writeFile(`${packet}/plan-check.json`, JSON.stringify(output,null,2)+'\n');
await writeFile(`${packet}/partitions-after.json`, JSON.stringify({mode:'after', rows:afterLists},null,2)+'\n');
console.log(JSON.stringify(output,null,2));
