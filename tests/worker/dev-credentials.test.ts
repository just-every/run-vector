import {env} from 'cloudflare:workers';
import {afterEach,expect,it} from 'vitest';
import {setupIntegrations} from './integration-fixture';
// @ts-expect-error Base operator-auth's dev admission is native ESM without a declaration file.
import {registerDevAdmission} from '../../vendor/base/operator-auth/dev-admission.mjs';
afterEach(()=>registerDevAdmission(null));
// The local dev layer registers the key gate's check; the deployed Worker never does, so it refuses every dev-minted token.
it('[API-001] a token minted in a dev session works only on a request that passes the key gate',async()=>{
 const f=await setupIntegrations(),ordinary=await f.issueToken(['issues:read'],'Ordinary');
 expect((await f.api(ordinary.token,'/issues')).status).toBe(200);
 // The fixture's real operator session becomes a dev session; the gate admits the requests that mint.
 await env.DB.prepare("UPDATE oa_sessions SET kind='dev'").run();
 registerDevAdmission(async()=>true);
 const minted=await f.issueToken(['issues:read'],'Dev minted');
 expect(await env.DB.prepare("SELECT count(*) n FROM oa_dev_credentials WHERE credential='integration_tokens'").first('n')).toBe(1);
 expect((await f.api(minted.token,'/issues')).status).toBe(200);
 registerDevAdmission(async()=>false);
 expect((await f.api(minted.token,'/issues')).status).toBe(401);
 registerDevAdmission(null);
 expect((await f.api(minted.token,'/issues')).status).toBe(401);
 expect((await f.api(ordinary.token,'/issues')).status).toBe(200);
});
