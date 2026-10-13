import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { setupImport } from './data-import-fixture';
import { invite } from './base-auth-fixture';
import { generateLinearWorkspace } from '../fixtures/import/linear/generate.mjs';
import type { ImportInput,ImportPreview } from '../../src/core/features/data/import/types';

type Run = { id:string;state:string;checkpoint:number;total:number;progress:{batchSize:number;batchesApplied:number;batchesTotal:number;unfinished:boolean;lastError:string|null} };
/** A generated 2,000-issue Linear workspace moving into two Vector teams whose
 * status names differ from Linear's, mapped per team as a person would. */
export async function setupLinearWorkspace(issues=2000) {
 const f=await setupImport();
 await f.mutate('/settings/teams','POST',{name:'Engineering',identifierPrefix:'EN'});
 await f.mutate('/settings/teams','POST',{name:'Operations',identifierPrefix:'OP'});
 const mayaCookie=await invite('maya@base.test',f.cookie);
 for(const name of ['Bug','Customer'])await f.mutate('/settings/labels','POST',{name,color:'#234567'});
 await f.mutate('/settings/projects','POST',{name:'Migration',leadOperatorId:f.owner});
 let state=await f.state();const engineering=state.teams.find(team=>team.name==='Engineering')!;
 await f.mutate('/settings/cycles','POST',{teamId:engineering.id,name:'Cycle 41',startsLocal:'2026-10-01T09:00',endsLocal:'2026-10-14T09:00',capacity:20});
 await f.mutate('/settings/cycles','POST',{teamId:engineering.id,name:'Cycle 42',startsLocal:'2026-10-15T09:00',endsLocal:'2026-10-28T09:00',capacity:20});
 state=await f.state();
 const teams=state.teams.filter(team=>['Engineering','Operations'].includes(team.name));
 const maya=(await env.DB.prepare("SELECT id FROM operators WHERE email='maya@base.test'").first<string>('id'))!;
 const workspace=(count:number,seed?:number,duplicates=0)=>generateLinearWorkspace({issues:count,seed,duplicates,teams:[{key:'ENG',name:'Engineering',cycles:['Cycle 41','Cycle 42']},{key:'OPS',name:'Operations',cycles:[]}],people:['Owner','Maya Chen'],strangers:['Former Teammate'],labels:['Bug','Customer'],projects:['Migration']});
 const generated=workspace(issues);
 const references={assignee:{'Maya Chen':maya},status:Object.fromEntries(teams.flatMap(team=>[['Todo','unstarted'],['In Progress','started'],['In Review','started'],['Done','completed']].map(([name,category])=>[team.name+'/'+name,team.statuses.find(status=>status.category===category)!.id])))};
 const input=(csv=generated.csv,source='linear-workspace'):ImportInput=>({format:'linear-csv',source,name:'linear-issues.csv',base64:Buffer.from(csv).toString('base64'),mapping:{},references});
 const resume=async(run:Run,status=200)=>{const response=await f.call('/data/import/runs/'+run.id+'/resume','POST',{});expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<Run>;};
 const createRun=async(value:ImportInput,review:ImportPreview)=>{const response=await f.apply(value,review);expect(response.status,await response.clone().text()).toBe(200);return response.json() as Promise<Run>;};
 return {...f,generated,workspace,teams,maya,mayaCookie,input,resume,createRun};
}
