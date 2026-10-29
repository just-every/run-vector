import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { workspaceStreamTools } from './workspace-streams.ts';
import { workspaceViewTools } from './workspace-views.ts';
import { workspaceNotificationTools } from './workspace-notifications.ts';
import { workspacePersonalTools } from './workspace-personal.ts';
import { workspaceReportTools } from './workspace-reports.ts';
import { workspaceAuditTools } from './workspace-audit.ts';

export { vectorWorkspaceResources } from './workspace-resources.ts';

export function vectorWorkspaceTools(env: WorkerBindings): ToolDefinition[] {
  return [...workspaceStreamTools(env), ...workspaceViewTools(env), ...workspaceNotificationTools(env),
    ...workspacePersonalTools(env), ...workspaceReportTools(env), ...workspaceAuditTools(env)];
}
