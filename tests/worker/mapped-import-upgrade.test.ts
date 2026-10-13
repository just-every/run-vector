import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
it('[DATA-002 DATA-003] populated native history, files, sessions and search survive adding reviewed import journals',async()=>provePopulatedUpgrade('0025_import_kit.sql'));
