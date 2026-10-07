import { assert, hash, validatePlan } from './validation.mjs';
import { validateArtifact } from './artifact.mjs';
import { validateMigrations, migrate } from './migrations.mjs';
import { reconcileResources, reconcileTriggers, checkCronOwnership } from './resources.mjs';
import { activeWorker, secretBindings, uploadWorker, durableNamespaces, durableMigration, workerOrigin } from './worker.mjs';
import { renderConfig, bindingsFor, verifyBindings } from './render.mjs';
import { verifyHealth } from './health.mjs';

/** Controller-owned plan, inert validated artifact bytes; no project imports or subprocesses. */
export async function deploy({api,plan,artifact,artifactSha256,previousReceipt,repeatOnly=false,onReceipt,env={},fetch=globalThis.fetch}) {
  validatePlan(plan); validateArtifact(artifact);
  for (const item of plan.d1) validateMigrations(item.migrations);
  const existing = await activeWorker(api,plan.worker);
  // An ordinary upgrade must not publish code or apply migrations before
  // detecting schedules outside this plan. Check again at trigger reconciliation.
  if (existing) await checkCronOwnership(api,plan);
  // Resolve missing secrets before resource writes. Existing opaque values are retained unchanged.
  const secrets = await secretBindings(api,plan.worker,plan,env,Boolean(existing));
  const resources = await reconcileResources(api,plan,{create:!previousReceipt});
  const baseConfig = renderConfig(plan,resources,api.accountId,artifact.source.sha,'',artifact.main,artifact.assets.length > 0);
  const fingerprint = hash({plan,config:baseConfig,source:artifact.source,modules:artifact.modules.map(({path,sha256}) => ({path,sha256})),assets:artifact.assets.map(({path,sha256}) => ({path,sha256}))});
  const config = renderConfig(plan,resources,api.accountId,artifact.source.sha,fingerprint,artifact.main,artifact.assets.length > 0);
  const bindings = bindingsFor(config,resources,plan);
  const namespaces = await durableNamespaces(api,plan);
  const migration = durableMigration(namespaces,existing);
  const priorFingerprint = existing?.settings.bindings.find(x => x.type === 'plain_text' && x.name === 'RER_DEPLOY_FINGERPRINT')?.text;
  const unchanged = priorFingerprint === fingerprint && secrets.missing.length === 0 && !migration;
  if (repeatOnly) assert(unchanged && previousReceipt?.fingerprint === fingerprint && previousReceipt?.provider?.versionId === existing?.versionId && previousReceipt?.provider?.etag === existing?.etag, 'repeat-deployment-drift');
  const migrations = [];
  for (const item of plan.d1) migrations.push({binding:item.binding,...await migrate(api,resources.d1.find(x => x.binding === item.binding).id,item.migrations,{apply:!unchanged})});
  if (unchanged) {
    assert(previousReceipt?.fingerprint === fingerprint && previousReceipt.accountId === api.accountId && previousReceipt.worker === plan.worker && previousReceipt.provider?.versionId === existing.versionId && previousReceipt.provider?.etag === existing.etag && previousReceipt.provider?.deploymentId === existing.deploymentId, 'no-op-requires-authenticated-prior-receipt');
    verifyBindings(existing.settings.bindings,bindings);
  }
  else await uploadWorker(api,{plan,artifact,bindings,secrets,migration,fingerprint});
  await reconcileTriggers(api,plan,resources,{mutate:!unchanged});
  const origin = await workerOrigin(api,plan.worker,{enable:!unchanged});
  const active = await activeWorker(api,plan.worker); assert(active,'missing-deployed-worker');
  verifyBindings(active.settings.bindings,bindings);
  const receipt = {version:1,accountId:api.accountId,worker:plan.worker,origin,source:artifact.source,run:artifact.run,artifactSha256,configSha256:hash(config),fingerprint,config,resources,
    durableObjects:await durableNamespaces(api,plan,{requireAll:true}),secrets:plan.secrets.map(x => x.binding),migrations,
    provider:{versionId:active.versionId,deploymentId:active.deploymentId,etag:active.etag},changed:!unchanged};
  if (onReceipt) await onReceipt(receipt);
  await verifyHealth({api,plan,receipt,fetch});
  return receipt;
}
