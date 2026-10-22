import { expect } from 'vitest';
import type { Part } from '@runeditrun/rer/modules/portability';
import type { ArchiveRecords } from './http-archive-fixture';

/** Restoration retains every archived value. New sign-ins and exports add
 * events, so their audit-table transport ordinals can move on re-export. */
export function expectAuditArchiveHistory(before: ArchiveRecords, after: ArchiveRecords) {
  const items=(records:ArchiveRecords)=>records.filter((r):r is Part=>r.kind==='part').flatMap(r=>r.items);
  const original=items(before),restored=items(after);
  const audit=(item:typeof original[number])=>item.kind==='row'&&item.table==='audit_records';
  expect(restored.filter(item=>!audit(item))).toEqual(original.filter(item=>!audit(item)));
  const originalAudit=original.filter(audit),current=restored.filter(audit);
  const priorIds=new Set(originalAudit.map(item=>item.kind==='row'?item.row.id:null));
  for(const item of originalAudit) {
    if(item.kind!=='row') throw Error('Expected audit row');
    const found=current.find(row=>row.kind==='row'&&row.row.id===item.row.id);
    expect(found?.kind==='row'?found.row:null).toEqual(item.row);
  }
  const added=current.filter(item=>item.kind==='row'&&!priorIds.has(item.row.id));
  expect(added.length).toBeGreaterThan(0);
  for(const item of added) {
    if(item.kind!=='row') throw Error('Expected audit row');
    expect(['auth.signed_in','archive.export.completed','archive.import.completed','archive.export.started']).toContain(item.row.action);
    expect(item.row.actor_kind).toBe('person');
    expect(item.row.actor_reference).toEqual(expect.any(String));
  }
}
