import { assert, stable } from './validation.mjs';
import { boundedJSON } from './provider.mjs';
import { activeWorker, workerOrigin, durableNamespaces } from './worker.mjs';
import { reconcileResources, reconcileTriggers } from './resources.mjs';
import { migrate } from './migrations.mjs';
import { bindingsFor, verifyBindings } from './render.mjs';
export async function verifyHealth({api,plan,receipt,fetch:request=globalThis.fetch,timeoutMs=30000}) {
  assert(receipt?.version === 1 && receipt.accountId === api.accountId && receipt.worker === plan.worker,'receipt-target-mismatch');
  const current = await activeWorker(api,plan.worker);
  assert(current && current.versionId === receipt.provider.versionId && current.deploymentId === receipt.provider.deploymentId && current.etag === receipt.provider.etag,'active-deployment-mismatch');
  const origin = await workerOrigin(api,plan.worker);
  assert(origin === receipt.origin,'health-origin-mismatch');
  const resources = await reconcileResources(api,plan,{create:false});
  assert(stable(resources) === stable(receipt.resources),'resource-identity-drift');
  verifyBindings(current.settings.bindings,bindingsFor(receipt.config,resources,plan));
  await reconcileTriggers(api,plan,resources,{mutate:false});
  const namespaces = await durableNamespaces(api,plan,{requireAll:true});
  assert(stable(namespaces) === stable(receipt.durableObjects),'durable-object-identity-drift');
  for (const item of plan.d1) await migrate(api,resources.d1.find(x => x.binding === item.binding).id,item.migrations,{apply:false});
  const secrets = await api.request(`/workers/scripts/${plan.worker}/secrets`);
  assert(Array.isArray(secrets) && plan.secrets.every(x => secrets.some(y => y.name === x.binding && y.type === 'secret_text')),'missing-deployed-secret');
  let response;
  try { response = await request(`${origin}/health`,{redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{'Cache-Control':'no-cache','Accept':'application/json'}}); }
  catch { throw new Error('health-transport-failed'); }
  assert(response.ok && response.status === 200 && !response.redirected,'health-http-failed');
  const body = await boundedJSON(response,65536);
  assert(body?.ok === true && body.deployment?.sourceSha === receipt.source.sha && body.deployment?.fingerprint === receipt.fingerprint && body.deployment?.versionId === current.versionId,'health-identity-mismatch');
  const after = await activeWorker(api,plan.worker);
  assert(after.versionId === current.versionId && after.deploymentId === current.deploymentId && after.etag === current.etag,'deployment-changed-during-health');
  return {ok:true,versionId:current.versionId};
}
