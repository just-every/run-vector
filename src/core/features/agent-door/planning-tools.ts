import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { planningProjectTools } from './planning-projects.ts';
import { planningTeamTools } from './planning-teams.ts';
import { planningCycleTools } from './planning-cycles.ts';
import { planningPortfolioTools } from './planning-portfolios.ts';
import { planningDocumentTools } from './planning-documents.ts';
import { planningTemplateTools } from './planning-templates.ts';

export function vectorPlanningTools(env: WorkerBindings): ToolDefinition[] {
  return [...planningProjectTools(env), ...planningTeamTools(env), ...planningCycleTools(env),
    ...planningPortfolioTools(env), ...planningDocumentTools(env), ...planningTemplateTools(env)];
}
