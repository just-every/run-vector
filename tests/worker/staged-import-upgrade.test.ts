import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
it('[DATA-006 DATA-003] populated history, files, sessions and search survive staged import runs; only the stated import objects change',async()=>provePopulatedUpgrade('0035_staged_imports.sql',{
 added:['table vector_import_runs','trigger vector_import_staged_apply'],
 removed:['trigger vector_import_whole_apply','trigger vector_import_whole_reversal'],until:'0035_staged_imports.sql',
}),120_000);
