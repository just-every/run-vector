import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
it('[BASE-OPS-002 DATA-001 DATA-005] populated previous schema gains archives without changing records, search, sessions or delivery history',async()=>provePopulatedUpgrade('0022_portability.sql'));
