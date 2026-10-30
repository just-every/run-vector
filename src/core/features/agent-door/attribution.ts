import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolContext } from '../../../../vendor/base/agent-door/index.ts';

/** Trusted call context, never a field accepted from request JSON. */
const actors = new AsyncLocalStorage<Pick<ToolContext,'actor'|'approvers'|'operationId'>>();
export const currentAgentActor = () => actors.getStore();
export function asAgent<T>(ctx: ToolContext, run:()=>Promise<T>):Promise<T> { return actors.run(ctx,run); }
export function agentActivity() {
  const current=actors.getStore();
  return {agentId:current?.actor.agent.id??null,agentOperationId:current?.operationId??null,agentApproversJson:current?JSON.stringify(current.approvers.map(p=>({id:p.id}))):null};
}
