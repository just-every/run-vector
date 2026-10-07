import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertCredentialFree } from '../../vendor/base/deploy-kit/prepare.mjs';
import { assert, hash } from '../../vendor/base/deploy-kit/validation.mjs';
import { MAX_ARTIFACT } from '../../vendor/base/deploy-kit/artifact.mjs';
import { packageBuild } from './pack.mjs';

export async function prepare(env = process.env, root = process.cwd()) {
  assertCredentialFree(env);
  assert(env.RER_PREPARE_ISOLATION === 'ephemeral-credential-free-job', 'prepare-requires-isolated-job');
  assert(/^[a-f0-9]{40}$/.test(env.RER_DEPLOY_SOURCE_SHA ?? ''), 'missing-source-sha');
  assert(/^\d+$/.test(env.RER_DEPLOY_RUN_ID ?? '') && /^\d+$/.test(env.RER_DEPLOY_RUN_ATTEMPT ?? ''), 'missing-run-identity');
  root = resolve(root);
  const output = env.RER_DEPLOY_ARTIFACT;
  const home = env.RER_PREPARE_HOME;
  for (const path of [output, home]) assert(path && path === resolve(path) && path !== root && !path.startsWith(root + '/'), 'prepare-path-must-be-outside-checkout');
  await mkdir(home, { recursive: false, mode: 0o700 });
  try {
    const cleanEnv = { PATH: env.PATH, HOME: home, CI: 'true', WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' };
    const run = argv => execFileSync(argv[0], argv.slice(1), { cwd: root, env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 900000, maxBuffer: 1024 * 1024 });
    const git = (...args) => run(['git', ...args]).trim();
    const source = { sha: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') };
    assert(source.sha === env.RER_DEPLOY_SOURCE_SHA && !git('status', '--porcelain', '--untracked-files=no'), 'prepare-source-mismatch');
    run(['pnpm', 'install', '--frozen-lockfile']);
    run(['pnpm', 'build']);
    assert(git('rev-parse', 'HEAD') === source.sha && !git('status', '--porcelain', '--untracked-files=no'), 'source-changed-during-build');
    const artifact = await packageBuild({ root, source, runIdentity: { id: env.RER_DEPLOY_RUN_ID, attempt: env.RER_DEPLOY_RUN_ATTEMPT } });
    const bytes = JSON.stringify(artifact);
    assert(Buffer.byteLength(bytes) <= MAX_ARTIFACT, 'artifact-too-large');
    await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
    return { sha256: hash(bytes), source, run: artifact.run };
  } finally { await rm(home, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { assert(process.argv.length === 2, 'prepare-no-arguments'); console.log(JSON.stringify(await prepare())); }
  catch (error) { console.error(JSON.stringify({ ok: false, code: error.message?.startsWith('prepare-') ? error.message : 'prepare-failed' })); process.exitCode = 1; }
}
