import { defineTool, type ToolDefinition, type ClassId } from '../../../../vendor/base/agent-door/index.ts';

export interface ClassProof {
  fixture: string;
  step: string;
  test: string;
  assertion: string;
}
export interface Documentation {
  job: string;
  classes: Partial<Record<ClassId, ClassProof>>;
}
export type DocumentedTool = ToolDefinition & { documentation: Documentation };

/** Documentation travels with the action used by the live MCP door. */
export function defineNativeTool(tool: DocumentedTool): DocumentedTool {
  defineTool(tool);
  return tool;
}
export function nativeDocumentation(job: string, step: string): Documentation {
  return { job, classes: { standard: {
    fixture: 'agent-surface.json', step,
    test: 'vendor/base/agent-door/conformance/journey.mjs', assertion: 'checkClasses',
  } } };
}
