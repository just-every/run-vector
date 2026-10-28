import { createBusinessSettings } from '../../../../vendor/base/business-settings/index.ts';
import { SettingsError, type ManagedMember, type TeamAdapter } from '../../../../vendor/base/business-settings/types.ts';
import type { WorkerBindings } from '../../app/bindings';

/** Native account admission precedes binding; a roster is not a sign-in proof.
 * Existing durable bindings are never reassigned by an email change. */
function nativeTeam(env: WorkerBindings): TeamAdapter {
  return {
    async ownerEmail() {
      return (await env.DB.prepare(`SELECT o.email FROM workspace_installation i
        JOIN operators o ON o.id=i.setup_operator_id WHERE o.removed_at IS NULL`)
        .first<{ email: string }>())?.email ?? null;
    },
    async prepare({ members, managed }) {
      const rows: ManagedMember[] = [];
      for (const member of members) {
        const previous = managed.find(row => row.email === member.email);
        const bound = previous?.operatorId;
        const native = await env.DB.prepare(`SELECT o.id,o.role FROM operators o
          JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id
          WHERE ${bound ? 'o.id=?' : 'lower(o.email)=?'} AND o.removed_at IS NULL AND a.status='active'
          AND o.workspace_id=(SELECT workspace_id FROM workspace_installation)
          AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
            OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id))`)
          .bind(bound ?? member.email).first<{ id: string; role: string }>();
        // The native invitation, sign-in and role doors own provisioning. Never
        // silently promote a Member, Guest or Viewer while adopting a roster.
        const matches = native && (member.role === 'admin' ? native.role === 'admin' : ['member', 'guest', 'viewer'].includes(native.role));
        if (!matches) throw new SettingsError('native_member_required', 409);
        rows.push({ email: member.email, operatorId: native.id, state: 'active', invite: member.invite });
      }
      for (const previous of managed) if (!rows.some(row => row.operatorId === previous.operatorId)) {
        rows.push({ ...previous, state: 'inactive' });
      }
      return { statements: [], rows, async afterCommit() {} };
    },
  };
}

export function vectorBusiness(env: WorkerBindings) {
  return createBusinessSettings({ db: env.DB, trust: env.RER_BUSINESS_TRUST,
    business: { settings: 1, values: ['display_name'], team: { roles: { admin: 'admin', member: 'member' } } },
    team: nativeTeam(env),
  });
}
