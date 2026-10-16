import type { ImportDiagnostic } from '../import/types';
import { importFieldLabel } from '../import/field-labels';
import { groupDiagnostics } from './import-client';

export function ImportDiagnostics({items}:{items:ImportDiagnostic[]}) {
  return <ul>{groupDiagnostics(items).map(group=>{
    const rows=[...new Set(group.rows.filter(row=>row>0))],settings=group.rows.includes(0);
    const location=[...(settings?['Import setup']:[]),...(rows.length?[`${rows.length===1?'Row':'Rows'} ${rows.slice(0,12).join(', ')}${rows.length>12?` and ${rows.length-12} more`:''}`]:[])].join(' · ');
    const message=group.message.startsWith('Reference was not found')?`Choose an existing ${group.field?importFieldLabel(group.field).toLowerCase():'value'} in Match your file to Vector, or choose a default.`:group.message;
    return <li key={(group.field??'')+group.code+group.message}>{group.field?importFieldLabel(group.field)+': ':''}{message} · {location}</li>;
  })}</ul>;
}
