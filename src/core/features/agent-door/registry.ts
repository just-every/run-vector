import { z } from 'zod';
import type { Person, ToolDefinition, ResourceDefinition, JsonSchemaObject } from '../../../../vendor/base/agent-door/index.ts';
import { ToolRefusal } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { issueListQuerySchema } from '../issues/list-schema';
import { projectPortfolioQuery } from '../projects/portfolio';
import { idArgs, issueArgs, readIssue, readIssues, readProject, readProjects, readMetadata, readNativeCycle } from './reads.ts';

const classification = () => [{ class: 'standard' as const, facts: { measure: 1 } }];
const empty = z.object({});
const objectOutput = { type: 'object', additionalProperties: true };
type Read = (person: Person, args: Record<string, unknown>) => Promise<unknown>;
function readTool(name: string, description: string, scope: string, clauses: string[], schema: z.ZodType, read: Read,
  link?: (args: Record<string, unknown>) => string): ToolDefinition {
  const inputSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchemaObject;
  // The shared door records and discards undeclared injection arguments. Native
  // query schemas remain authoritative for every declared parameter.
  return { name: `vector.${name}`, title: description, description, scope, readOnly: true,
    inputSchema, outputSchema: objectOutput, clauses, classes: ['standard'], classify: classification, untrusted: true,
    async run(args, ctx) {
      const result = await read(ctx.person, schema.parse(args) as Record<string, unknown>);
      return { result, ...(link ? { resources: [{ uri: link(args), name: description }] } : {}) };
    },
  };
}

export function vectorReadTools(env: WorkerBindings): ToolDefinition[] {
  return [
    readTool('issues.list', 'Find visible issues', 'issues:read', ['AGENT-005', 'OPS-001', 'VIEW-001'], issueListQuerySchema,
      (person, args) => readIssues(env, person, args)),
    readTool('issues.read', 'Read an issue and its evidence', 'issues:read', ['AGENT-005', 'OPS-001', 'ISSUE-001'], issueArgs,
      (person, args) => readIssue(env, person, String(args.identifier)), args => `vector://issues/${args.identifier}`),
    readTool('projects.list', 'Read visible project planning', 'projects:read', ['AGENT-005', 'PROJ-001'], projectPortfolioQuery,
      (person, args) => readProjects(env, person, args)),
    readTool('projects.read', 'Read a visible project', 'projects:read', ['AGENT-005', 'PROJ-001'], idArgs,
      (person, args) => readProject(env, person, String(args.id)), args => `vector://projects/${args.id}`),
    readTool('metadata.read', 'Read native workspace planning options', 'metadata:read', ['AGENT-005', 'OPS-001'], empty,
      person => readMetadata(env, person), () => 'vector://workspace/planning'),
    readTool('cycles.read', 'Read a visible cycle and its retained report', 'cycles:read', ['AGENT-005', 'CYCLE-001'], idArgs,
      (person, args) => readNativeCycle(env, person, String(args.id)), args => `vector://cycles/${args.id}`),
  ];
}

export function vectorReadResources(env: WorkerBindings): ResourceDefinition[] {
  const resource = (uriTemplate: string, scope: string, name: string, read: (person: Person, key: string) => Promise<unknown>): ResourceDefinition => ({
    uriTemplate, name, scope, classes: ['standard'], classify: classification,
    async read(uri, ctx) {
      try { return { json: await read(ctx.person, decodeURIComponent(uri.split('/').at(-1)!)), untrusted: true }; }
      catch (error) {
        if (error instanceof z.ZodError || error instanceof ToolRefusal && ['not_found', 'forbidden'].includes(error.code)) return null;
        throw error;
      }
    },
  });
  return [
    resource('vector://issues/{identifier}', 'issues:read', 'Issue and evidence', (person, key) => readIssue(env, person, issueArgs.parse({ identifier: key }).identifier)),
    resource('vector://projects/{id}', 'projects:read', 'Project planning', (person, key) => readProject(env, person, idArgs.parse({ id: key }).id)),
    resource('vector://cycles/{id}', 'cycles:read', 'Cycle report', (person, key) => readNativeCycle(env, person, idArgs.parse({ id: key }).id)),
    resource('vector://workspace/planning', 'metadata:read', 'Workspace planning options', person => readMetadata(env, person)),
  ];
}
