import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
import {proveDeploymentFollowupUpgrade} from './deployment-followup-upgrade';
it('[BASE-OPS-002 OWNER-CLAIM-001 PUSH-003] existing configured owners, sessions, search, files and history survive signed claim adoption and the follow-up upgrade',async()=>{
 await proveDeploymentFollowupUpgrade();
 await provePopulatedUpgrade('0024_owner_claim.sql');
},120_000);
