import { WorkerEntrypoint } from 'cloudflare:workers';
import { createServerApp } from '../../src/core/app/server';
import { vectorAgentDoor, vectorAgentTools, vectorAgentResources } from '../../src/core/features/agent-door/index.server';
import type { WorkerBindings } from '../../src/core/app/bindings';
import type { AgentDoor } from '../../vendor/base/agent-door/index';
import { sendDueReminders } from '../../src/core/features/due-reminders/service';
import { schemaValid } from '../../vendor/base/agent-door/json-schema';

const app = createServerApp();

/** Test-only RPC reaches the production embedded door without an HTTP backdoor. */
export default class NativeInvocation extends WorkerEntrypoint<WorkerBindings> {
  fetch(request: Request) { return app.fetch(request, this.env); }
  catalogue() {
    const tools = vectorAgentTools(this.env);
    return { tools: tools.map(({ name, scope, readOnly, classes, clauses }) => ({ name, scope, readOnly, classes, clauses })),
      invalidSchemas: tools.filter(tool => !schemaValid(tool.inputSchema)).map(tool => ({ name: tool.name, inputSchema: tool.inputSchema })),
      resources: vectorAgentResources(this.env).map(resource => resource.uriTemplate) };
  }
  scheduledReminders() { return sendDueReminders(this.env); }
  invoke(...args: Parameters<AgentDoor['invoke']>) {
    return vectorAgentDoor(this.env).invoke(...args);
  }
}
