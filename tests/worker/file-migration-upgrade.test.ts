import { it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';

it('[DATA-017 DATA-005] populated pre-migration installations upgrade without changing retained native data and export the extended inventory',async()=>{
  await provePopulatedUpgrade('0126_file_migrations.sql');
},180000);
