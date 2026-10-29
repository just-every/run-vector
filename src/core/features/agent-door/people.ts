import type { PeopleAdapter, Person } from '../../../../vendor/base/agent-door/index.ts';
import { requireOperator } from '../auth/service';
import type { WorkerBindings } from '../../app/bindings';

/** Product ids are authoritative. Base auth roles are implementation owners. */
export function nativePeople(env: WorkerBindings): PeopleAdapter {
  const person = (id: string) => env.DB.prepare(`SELECT o.id,o.email,o.name,o.role,
    (o.removed_at IS NULL AND a.status='active' AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
      OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id))) AS active
    FROM operators o JOIN vector_auth_operators m ON m.operator_id=o.id
    JOIN oa_operators a ON a.id=m.auth_id WHERE o.id=?`).bind(id).first<Person>();
  const owner = async () => (await env.DB.prepare('SELECT setup_operator_id AS id FROM workspace_installation').first<{id:string}>())?.id;
  return {
    async person(id) { const p=await person(id); return p ? {...p,active:Boolean(p.active)} : null; },
    async session(request) { const p=await requireOperator(env,request); return p ? this.person(p.id) : null; },
    async sponsor({sub}) {
      const settings=await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string}>();
      if (!settings) return null;
      const id=settings.owner_id===sub ? await owner() : (await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state='active'").bind(sub).first<{operator_id:string}>())?.operator_id;
      return id ? this.person(id) : null;
    },
    async businessMember(p) {
      const settings=await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string}>();
      if (!settings) return null;
      if (p.id===await owner()) return {id:settings.owner_id,role:'owner'};
      const row=await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state='active'").bind(p.id).first<{business_id:string;business_role:string}>();
      return row?.business_id ? {id:row.business_id,role:row.business_role==='admin'?'editor':null} : null;
    },
    // A local product promotion never supplies Business policy authority.
    businessRole: p => p.role==='owner'?'owner':null,
  };
}
