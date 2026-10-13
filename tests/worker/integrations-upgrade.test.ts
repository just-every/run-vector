import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
it('[API-001 INTAKE-001 GITHUB-001] populated history, files, active sessions and search survive integration ledgers without replay',async()=>provePopulatedUpgrade('0027_integrations.sql'));
