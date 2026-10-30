import { WorkerEntrypoint } from 'cloudflare:workers';
import { createServerApp } from '../../src/core/app/server';
import { vectorAgentDoor, vectorAgentTools, vectorAgentResources } from '../../src/core/features/agent-door/index.server';
import type { WorkerBindings } from '../../src/core/app/bindings';
import type { AgentDoor } from '../../vendor/base/agent-door/index';
import { sendDueReminders } from '../../src/core/features/due-reminders/service';

const app = createServerApp();

/** Test-only RPC reaches the production embedded door without an HTTP backdoor. */
export default class NativeInvocation extends WorkerEntrypoint<WorkerBindings> {
  fetch(request: Request) { return app.fetch(request, this.env); }
  catalogue() {
    return { tools: vectorAgentTools(this.env).map(({ name, scope, readOnly, classes, clauses }) => ({ name, scope, readOnly, classes, clauses })),
      resources: vectorAgentResources(this.env).map(resource => resource.uriTemplate) };
  }
  scheduledReminders() { return sendDueReminders(this.env); }
  invoke(...args: Parameters<AgentDoor['invoke']>) {
    return vectorAgentDoor(this.env).invoke(...args);
  }
}
