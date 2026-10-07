import { lstat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cloudflare } from './provider.mjs';
import { readArtifact, regularBytes } from '../../vendor/base/deploy-kit/artifact.mjs';
import { deploy } from '../../vendor/base/deploy-kit/deploy.mjs';
import { verifyHealth } from '../../vendor/base/deploy-kit/health.mjs';
import { assert, hash } from '../../vendor/base/deploy-kit/validation.mjs';
import { vectorPlan } from './plan.mjs';
import { validateSuppliedSecrets } from './input-validation.mjs';

export async function main(args = process.argv.slice(2), env = process.env, dependencies = {}) {
  assert(args.length === 1 && ['setup', 'deploy', 'health'].includes(args[0]), 'usage-setup-deploy-health');
  assert(!env.NODE_OPTIONS && !env.NODE_PATH && !env.EVIDENCE_WRITE_TOKEN, 'unsafe-controller-environment');
  const required = ['RER_DEPLOY_ARTIFACT', 'RER_DEPLOY_ARTIFACT_SHA256', 'RER_DEPLOY_SOURCE_SHA', 'RER_DEPLOY_RUN_ID', 'RER_DEPLOY_RUN_ATTEMPT', 'RER_DEPLOY_RECEIPT', 'RER_DEPLOY_PLAN', 'CF_THROWAWAY_ACCOUNT_ID', 'CF_THROWAWAY_API_TOKEN'];
  const missing = required.filter(key => typeof env[key] !== 'string' || !env[key].trim());
  if (missing.length) { const error = new Error('missing-input'); error.inputs = missing; throw error; }
  validateSuppliedSecrets(env);
  for (const key of ['RER_DEPLOY_ARTIFACT', 'RER_DEPLOY_RECEIPT', 'RER_DEPLOY_PLAN']) assert(env[key] === resolve(env[key]), 'input-path-must-be-absolute');
  const expected = { sha256: env.RER_DEPLOY_ARTIFACT_SHA256, sourceSha: env.RER_DEPLOY_SOURCE_SHA, runId: env.RER_DEPLOY_RUN_ID, runAttempt: env.RER_DEPLOY_RUN_ATTEMPT };
  const artifact = await readArtifact(env.RER_DEPLOY_ARTIFACT, expected);
  const configuration = JSON.parse(await regularBytes(env.RER_DEPLOY_PLAN, 16384));
  const worker = configuration.worker;
  const api = cloudflare({ accountId: env.CF_THROWAWAY_ACCOUNT_ID, token: env.CF_THROWAWAY_API_TOKEN, fetch: dependencies.fetch ?? globalThis.fetch });
  const account = await api.request('/workers/subdomain');
  assert(typeof account.subdomain === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(account.subdomain), 'invalid-account-subdomain');
  const plan = vectorPlan(artifact, configuration, `https://${worker}.${account.subdomain}.workers.dev`);
  let previousReceipt;
  try {
    const stat = await lstat(env.RER_DEPLOY_RECEIPT);
    assert((stat.mode & 0o077) === 0, 'receipt-permissions');
    previousReceipt = JSON.parse(await regularBytes(env.RER_DEPLOY_RECEIPT, 1024 * 1024));
    assert(previousReceipt.run?.id === artifact.run.id && previousReceipt.run?.attempt === artifact.run.attempt && previousReceipt.source?.sha === artifact.source.sha && previousReceipt.artifactSha256 === expected.sha256 && hash(previousReceipt.config) === previousReceipt.configSha256, 'receipt-custody-mismatch');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (args[0] === 'health') {
    assert(previousReceipt, 'missing-receipt');
    await verifyHealth({ api, plan, receipt: previousReceipt, fetch: dependencies.fetch ?? globalThis.fetch });
    return { ok: true, changed: false, worker, origin: previousReceipt.origin };
  }
  const receipt = await deploy({ api, plan, artifact, artifactSha256: expected.sha256, previousReceipt, repeatOnly: Boolean(previousReceipt), env, fetch: dependencies.fetch ?? globalThis.fetch,
    onReceipt: async candidate => { if (!previousReceipt) await writeFile(env.RER_DEPLOY_RECEIPT, JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); } });
  if (previousReceipt) assert(receipt.changed === false, 'existing-receipt-cannot-be-overwritten');
  return { ok: true, changed: receipt.changed, worker, origin: receipt.origin, versionId: receipt.provider.versionId };
}
export async function command(args) {
  try { console.log(JSON.stringify(await main(args))); }
  catch (error) { console.error(JSON.stringify(error.message === 'missing-input' ? { ok: false, code: 'missing-input', inputs: error.inputs } : { ok: false, code: 'deployment-failed' })); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await command();
