import type { PeopleAdapter, Person } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { requireOperator } from '../auth/service';

/** Vector's product identity, never the implementation-level OA owner role. */
export function vectorPeople(env: WorkerBindings): PeopleAdapter {
  const person = async (id: string): Promise<Person | null> => {
    const row = await env.DB.prepare(`SELECT o.id,o.email,o.name,o.role FROM operators o
      JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id
      WHERE o.id=? AND o.removed_at IS NULL AND a.status='active'
      AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
        OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id))`)
      .bind(id).first<Omit<Person, 'active'>>();
    return row ? { ...row, active: true } : null;
  };
  const owner = () => env.DB.prepare(`SELECT setup_operator_id AS id FROM workspace_installation
    WHERE setup_operator_id IS NOT NULL`).first<{ id: string }>();
  const settings = () => env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0')
    .first<{ owner_id: string | null }>();
  return {
    person,
    async session(request) {
      const current = await requireOperator(env, request);
      return current ? person(current.id) : null;
    },
    async sponsor({ sub }) {
      const state = await settings();
      if (!state) return null;
      if (state.owner_id === sub) {
        const installation = await owner();
        return installation ? person(installation.id) : null;
      }
      const member = await env.DB.prepare(`SELECT operator_id FROM bs_team
        WHERE business_id=? AND state='active'`).bind(sub).first<{ operator_id: string | null }>();
      return member?.operator_id ? person(member.operator_id) : null;
    },
    businessRole: current => current.role === 'owner' ? 'owner' : current.role === 'admin' ? 'editor' : null,
    async businessMember(current) {
      if (!(await person(current.id))) return null;
      const state = await settings();
      if (!state) return null;
      if (state.owner_id && (await owner())?.id === current.id) return { id: state.owner_id, role: 'owner' };
      const member = await env.DB.prepare(`SELECT business_id,business_role FROM bs_team
        WHERE operator_id=? AND state='active' AND business_id IS NOT NULL`)
        .bind(current.id).first<{ business_id: string; business_role: string }>();
      return member ? { id: member.business_id, role: member.business_role === 'admin' ? 'editor' : null } : null;
    },
  };
}
