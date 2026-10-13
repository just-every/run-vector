import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
it('[BASE-OPS-002 OWNER-CLAIM-001] existing configured owners, sessions, search, files and history survive signed claim adoption',async()=>provePopulatedUpgrade('0024_owner_claim.sql'));
