import { readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { collectBuildModules } from '../../vendor/base/deploy-kit/build-modules.mjs';
import { collectFiles, regularBytes, validateArtifact } from '../../vendor/base/deploy-kit/artifact.mjs';
import { assert, hash, localPath } from '../../vendor/base/deploy-kit/validation.mjs';

/** Only inert bytes cross the build/controller boundary. */
export async function packageBuild({ root, source, runIdentity }) {
  const build = join(root, 'dist/server');
  const config = JSON.parse(await regularBytes(join(build, 'wrangler.json'), 1024 * 1024));
  const main = localPath(relative(build, resolve(build, config.main)));
  const modules = await collectBuildModules(build, config, main);
  const assets = await collectFiles(join(root, 'dist/client'));
  const migrations = [];
  for (const name of (await readdir(join(root, 'migrations/core'))).sort()) {
    assert(/^[0-9]+_[a-zA-Z0-9_-]+\.sql$/.test(name), 'unexpected-migration-file');
    const sql = (await regularBytes(join(root, 'migrations/core', name), 512000)).toString('utf8');
    migrations.push({ binding: 'DB', name, sql, sha256: hash(sql) });
  }
  const artifact = { version: 1, source, run: runIdentity, main, modules, assets, migrations };
  validateArtifact(artifact);
  return artifact;
}
