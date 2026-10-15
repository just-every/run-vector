import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {readOwnedGroup} from '@runeditrun/rer/internal/onboarding/local/process-table.mjs';
const execute=promisify(execFile);

// Read numeric ancestry only, never process arguments or environment. This is
// verification custody; the copied runner remains the only signal/kill owner.
export async function developmentGroups(leader) {
 const {stdout}=await execute('ps',['-ax','-o','pid=','-o','ppid=','-o','pgid=']);
 const rows=stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));
 const owned=new Set([leader]);
 for(let changed=true;changed;){changed=false;for(const [pid,parent] of rows)if(owned.has(parent)&&!owned.has(pid)){owned.add(pid);changed=true;}}
 assert.ok(rows.some(([pid])=>pid===leader),'registered development owner is alive');
 // The global launcher can share its parent's group. Track only complete
 // descendant groups, never an unrelated parent or its other children.
 const groups=[...new Set(rows.filter(([pid])=>owned.has(pid)).map(([, ,group])=>group))]
  .filter(group=>rows.filter(([, ,candidate])=>candidate===group).every(([pid])=>owned.has(pid)));
 assert.ok(groups.length,'actual development has a fully owned process group');
 const snapshots=await Promise.all(groups.map(async group=>({group,members:await readOwnedGroup(group)})));
 assert.ok(snapshots.some(row=>row.members.length),'actual development runtime has an owned nested group');
 return snapshots;
}
export async function assertDevelopmentGone(snapshots) {
 for(const {group} of snapshots)assert.equal((await readOwnedGroup(group)).length,0,`owned development subgroup ${group} drained`);
}
