import { Buffer } from 'node:buffer';
import { generateLinearWorkspace } from '../fixtures/import/linear/generate.mjs';
import type { setupLinearWorkspace } from './linear-workspace-fixture';
import type { ImportInput } from '../../src/core/features/data/import/types';

type Workspace = Pick<Awaited<ReturnType<typeof setupLinearWorkspace>>, 'mutate'|'state'|'input'>;
/** Give the rollback scenarios real, separate identifier streams so their
 * imports and native issues cannot consume a paused resume scenario's numbers. */
export async function setupErasureRollbackTeams(f:Workspace,stranger:string) {
  const definitions=[
    {key:'ENG',name:'Rollback Engineering',identifierPrefix:'RE',cycles:['Cycle 41','Cycle 42']},
    {key:'OPS',name:'Rollback Operations',identifierPrefix:'RO',cycles:[]},
  ];
  for(const {name,identifierPrefix} of definitions)await f.mutate('/settings/teams','POST',{name,identifierPrefix});
  const state=await f.state(),teams=definitions.map(definition=>state.teams.find(team=>team.name===definition.name)!);
  await f.mutate('/settings/cycles','POST',{teamId:teams[0].id,name:'Cycle 41',startsLocal:'2026-10-01T09:00',endsLocal:'2026-10-14T09:00',capacity:20});
  await f.mutate('/settings/cycles','POST',{teamId:teams[0].id,name:'Cycle 42',startsLocal:'2026-10-15T09:00',endsLocal:'2026-10-28T09:00',capacity:20});
  const statuses=Object.fromEntries(teams.flatMap(team=>[['Todo','unstarted'],['In Progress','started'],['In Review','started'],['Done','completed']].map(([name,category])=>[team.name+'/'+name,team.statuses.find(status=>status.category===category)!.id])));
  const input=(issues:number,seed:number,source:string):ImportInput=>{
    const generated=generateLinearWorkspace({issues,seed,teams:definitions,people:['Owner','Maya Chen'],strangers:[stranger],labels:['Bug','Customer'],projects:['Migration']});
    const original=f.input(generated.csv,source);
    return {...original,format:'linear-api-json',references:{...original.references,status:statuses},api:{name:'linear-api.json',base64:Buffer.from(JSON.stringify(generated.api)).toString('base64')}};
  };
  return {input,nativeTeamId:teams[0].id};
}
