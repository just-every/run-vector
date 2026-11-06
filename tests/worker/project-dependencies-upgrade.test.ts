import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';

it('populated project dependency upgrade preserves project and issue identities without manufacturing historical links or notices',async()=>{
  await provePopulatedUpgrade('0126_project_dependencies.sql',{
    until:'0126_project_dependencies.sql',
    added:['table project_dependencies','index project_dependencies_blocking_idx','trigger project_dependency_insert','trigger project_dependency_immutable','table project_notifications','index project_notifications_recipient_order'],
    changed:[],removed:[],
  },['projects','issues']);
  for(const table of ['project_dependencies','project_notifications'])
    expect(await env.DB.prepare('SELECT count(*) n FROM '+table).first<number>('n')).toBe(0);
},180000);
