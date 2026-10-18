import { it } from 'vitest';
import { provePopulatedUpgrade } from './populated-upgrade';

it('[PROJ-001 DATA-005] populated project upgrade preserves prior records and exports the extended planning inventory',async()=>{
  await provePopulatedUpgrade('0062_project_fields.sql',{
    added:['table project_labels','index project_labels_label_idx','trigger project_dates_insert','trigger project_dates_update','trigger project_label_admission','trigger project_label_update_admission','trigger project_label_usage'],
    changed:['table projects','table labels'],removed:[],
  },['projects','labels']);
},180000);
