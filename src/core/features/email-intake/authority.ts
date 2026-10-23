import { z } from 'zod';
import { mutationDatabase } from '../auth/mutation-database';
import { loadAuthority } from '../roles/authority';
import { decide } from '../roles/policy';
import { settingsActor, SettingsError } from '../settings/repository';
import type { IntakeSettings } from './types';

export const idSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const mailbox = z.email().max(254).transform(value => value.toLowerCase());
export const settingsSchema = z.object({
  enabled: z.boolean(), address: mailbox,
  allowedSenders: z.array(mailbox).max(100).refine(values => new Set(values).size === values.length),
  acknowledgement: z.boolean(),
  eventVerificationKey: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(80).max(256).optional(),
}).strict().refine(value => !value.enabled || value.allowedSenders.length > 0, 'Enabled intake requires allowed senders.');

export async function requireTeamSettings(db: D1Database, actor: string, teamId: string) {
  const person = await settingsActor(db, actor);
  const team = await db.prepare('SELECT id FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL')
    .bind(teamId, person.workspace_id).first();
  if (!team) throw new SettingsError('not_found', 'The team is unavailable.', 404);
  const authority = await loadAuthority(db, actor, [teamId]);
  // The existing team-settings row carries ROLE-009's exact permission.
  if (!authority || decide(authority, { row: 'teams.settings', teams: [teamId] }) !== 'allow')
    throw new SettingsError('forbidden', 'Your role cannot manage this team’s email intake.', 403);
  return person;
}

/** The configuring member delegates native creation to this feature. Sender
 * claims never become an operator identity, session or workspace membership. */
export async function intakeDatabase(source: D1Database, config: IntakeSettings) {
  if (!config.actor_operator_id) throw new SettingsError('intake_unavailable', 'Email intake needs a current team manager.', 409);
  await requireTeamSettings(source, config.actor_operator_id, config.team_id);
  return mutationDatabase(source, config.actor_operator_id, undefined, undefined, {
    sql: `EXISTS(SELECT 1 FROM team_email_intake e JOIN teams t ON t.id=e.team_id
      JOIN operators o ON o.id=e.actor_operator_id WHERE e.team_id=? AND e.enabled=1 AND e.revision=?
      AND e.actor_operator_id=? AND t.archived_at IS NULL AND o.removed_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
      AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
      AND (o.role IN('owner','admin') OR (o.role='member' AND EXISTS(SELECT 1 FROM team_members m
        WHERE m.team_id=t.id AND m.operator_id=o.id AND (m.role='owner' OR t.settings_permission='all_members')))))`,
    values: [config.team_id, config.revision, config.actor_operator_id],
  });
}

export function automationAudit(db: D1Database, id: string, issueId: string, action: string, at: string) {
  return db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
    SELECT ?,NULL,?,i.identifier,i.id,?,?,t.workspace_id,'automation','automation:email-intake'
    FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=?`).bind(id, action, at, at, issueId);
}
