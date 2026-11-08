import { env } from 'cloudflare:workers';
import { expect,it } from 'vitest';
import { request } from './base-auth-fixture';
import { sampleBindings } from './sample-auth-fixture';
import { provePopulatedUpgrade } from './populated-upgrade';
it('populated leadership digest upgrade retains initiatives, subscriptions and existing data without inventing consent or historical sends',async()=>{
  await provePopulatedUpgrade('0133_leadership_digests.sql',{
    until:'0134_leadership_restore_holds.sql',
    added:['table leadership_digest_preferences','table leadership_digest_receipts','index leadership_digest_due','table leadership_digest_restore_holds','trigger leadership_digest_restore_hold','trigger leadership_digest_recipient_erased','trigger leadership_digest_restore_complete','trigger leadership_digest_restore_updated'],
    changed:[],removed:[],
  },['projects','issues','initiatives','subject_subscriptions'],async cookie=>{
    const session=await request('/api/session','GET',undefined,cookie,sampleBindings);
    const {operatorId}=await session.json() as {operatorId:string};
    const response=await request('/api/initiatives','POST',{name:'synthetic-vector-4040',ownerOperatorId:operatorId},cookie,sampleBindings);
    expect(response.status).toBe(201);const root=await response.json() as {id:string};
    expect((await request('/api/subscriptions','POST',{subjectType:'initiative',subjectId:root.id},cookie,sampleBindings)).status).toBe(201);
  });
  for(const table of ['leadership_digest_preferences','leadership_digest_receipts','leadership_digest_restore_holds'])
    expect(await env.DB.prepare('SELECT count(*) n FROM '+table).first<number>('n')).toBe(0);
},180000);
