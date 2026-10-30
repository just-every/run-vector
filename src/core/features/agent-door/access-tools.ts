import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { vectorMembershipTools } from './access-membership.ts';
import { vectorTeamPermissionTools } from './access-permissions.ts';
import { vectorWorkspaceAccessTools } from './access-settings.ts';
import { vectorMembershipRecordTools } from './access-membership-record.ts';

/** Product-owned adapters over the existing native administration services.
 * Registry and surface integration remain with the edition's door assembly. */
export function vectorAccessTools(env: WorkerBindings): ToolDefinition[] {
  return [...vectorMembershipTools(env), ...vectorMembershipRecordTools(env), ...vectorTeamPermissionTools(env), ...vectorWorkspaceAccessTools(env)];
}
