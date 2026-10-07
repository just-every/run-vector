import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageBuild } from '../prepare.mjs';
import { readArtifact, moduleType, validateArtifact } from '../artifact.mjs';
import { uploadWorker } from '../worker.mjs';
import { hash } from '../validation.mjs';

const outputConfig = () => ({main:'index.js',no_bundle:true,rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]});
async function buildFixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(),'deploy-build-contract-')));
  t.after(() => rm(root,{recursive:true,force:true}));
  const server = join(root,'default-seed/dist/server');
  const files = {
    'index.js':'import { app } from "./assets/app.js"; export default app;',
    'assets/app.js':'export const app = {fetch: async () => (await import("./lazy.mjs")).respond()};',
    'assets/lazy.mjs':'export const respond = () => new Response("lazy route");',
    'assets/add.wasm':Buffer.from([0,97,115,109,1,0,0,0]),
    'assets/message.txt':'runtime text',
    'assets/template.html':'<p>runtime template</p>',
    'assets/query.sql':'SELECT 1;',
    'assets/data.bin':Buffer.from([1,2,3]),
    '.vite/manifest.json':JSON.stringify({'virtual:cloudflare/worker-entry':{file:'index.js',isEntry:true,imports:['_app.js']},'_app.js':{file:'assets/app.js',dynamicImports:['_lazy.mjs']},'_lazy.mjs':{file:'assets/lazy.mjs',isDynamicEntry:true}}),
    'wrangler.json':JSON.stringify(outputConfig()),
    'index.js.map':'{"version":3,"sources":["src/index.ts"]}',
    'assets/app.js.map':'{"version":3}',
    'build-report.json':'{"not_a_runtime_module":true}',
  };
  for (const [path,bytes] of Object.entries(files)) {
    await mkdir(join(server,path,'..'),{recursive:true}); await writeFile(join(server,path),bytes);
  }
  await mkdir(join(root,'default-seed/dist/client'),{recursive:true});
  await writeFile(join(root,'default-seed/dist/client/index.html'),'<h1>app</h1>');
  await mkdir(join(root,'default-seed/migrations/core'),{recursive:true});
  await writeFile(join(root,'default-seed/migrations/core/0001_notes.sql'),'CREATE TABLE notes(id TEXT);');
  return {root,server,files,args:{root,source:{sha:'1'.repeat(40),tree:'2'.repeat(40)},runIdentity:{id:'91',attempt:'2'}}};
}

test('pinned Vite no-bundle output selects actual upload rules, excluding manifest/config/source maps', async t => {
  const {root,server,files,args} = await buildFixture(t);
  const artifact = await packageBuild(args);
  const wanted = Object.keys(files).filter(path => /\.(js|mjs|wasm|txt|html|sql|bin)$/.test(path)).sort();
  assert.deepEqual(artifact.modules.map(x => x.path).sort(),wanted);
  for (const file of artifact.modules) {
    assert.deepEqual(Buffer.from(file.base64,'base64'),await readFile(join(server,file.path)));
    assert.equal(file.sha256,hash(await readFile(join(server,file.path))));
  }
  assert.deepEqual(artifact.source,args.source);
  assert.deepEqual(artifact.run,args.runIdentity);
  assert.equal(artifact.migrations[0].sha256,hash('CREATE TABLE notes(id TEXT);'));
  const bytes = JSON.stringify(artifact);
  const path = join(root,'artifact.json'); await writeFile(path,bytes);
  const expected = {sha256:hash(bytes),sourceSha:args.source.sha,runId:'91',runAttempt:'2'};
  assert.deepEqual(await readArtifact(path,expected),artifact);
  await assert.rejects(readArtifact(path,{...expected,runAttempt:'3'}),/artifact-custody-mismatch/);
  await assert.rejects(readArtifact(path,{...expected,sha256:'0'.repeat(64)}),/artifact-digest-mismatch/);
});

test('every selected additional module receives its real multipart content type and bytes', async t => {
  const {args} = await buildFixture(t);
  const artifact = await packageBuild(args); artifact.assets = [];
  let uploads = 0;
  const api = {request:async (path,{method,body}) => {
    uploads++;
    assert.equal(path,'/workers/scripts/build-proof?bindings_inherit=strict');
    assert.equal(method,'PUT');
    const metadata = JSON.parse(await body.get('metadata').text());
    assert.equal(metadata.main_module,'index.js');
    assert.equal(body.has('.vite/manifest.json'),false);
    assert.equal(body.has('wrangler.json'),false);
    assert.equal(body.has('index.js.map'),false);
    assert.equal(body.has('assets/lazy.mjs'),true);
    for (const module of artifact.modules) {
      const part = body.get(module.path);
      assert.equal(part.type,moduleType(module.path));
      assert.deepEqual(Buffer.from(await part.arrayBuffer()),Buffer.from(module.base64,'base64'));
    }
  }};
  await uploadWorker(api,{plan:{worker:'build-proof',compatibilityDate:'2026-09-08'},artifact,bindings:[],secrets:{bindings:[]},fingerprint:hash(artifact)});
  assert.equal(uploads,1);
});

test('unsupported output rules, bundled output, disabled discovery, and alternate module roots fail explicitly', async t => {
  const {server,args} = await buildFixture(t);
  for (const config of [{main:'index.js'}, {...outputConfig(),no_bundle:false}, {...outputConfig(),rules:[{type:'Text',globs:['**/*.json']}]}, {...outputConfig(),find_additional_modules:false}, {...outputConfig(),base_dir:'../elsewhere'}]) {
    await writeFile(join(server,'wrangler.json'),JSON.stringify(config));
    await assert.rejects(packageBuild(args),/unsupported-build-module-rules/);
  }
});

test('a missing, escaping or unsupported entrypoint is not hidden by upload file selection', async t => {
  const {server,args} = await buildFixture(t);
  for (const [main,error] of [['missing.js',/artifact-main-missing/],['../../outside.js',/invalid-local-path/],['.vite/manifest.json',/unsupported-build-main/]]) {
    await writeFile(join(server,'wrangler.json'),JSON.stringify({...outputConfig(),main}));
    await assert.rejects(packageBuild(args),error);
  }
});

test('build metadata remains subject to regular-file checks even though it is not uploaded', async t => {
  const {server,args} = await buildFixture(t);
  await rm(join(server,'.vite/manifest.json'));
  await symlink(join(server,'wrangler.json'),join(server,'.vite/manifest.json'));
  await assert.rejects(packageBuild(args),/symlink-in-artifact/);
});

test('an injected JSON upload module remains unsupported rather than becoming metadata', async t => {
  const {args} = await buildFixture(t);
  const artifact = await packageBuild(args);
  artifact.modules.push({path:'.vite/manifest.json',base64:Buffer.from('{}').toString('base64'),sha256:hash('{}')});
  assert.throws(() => validateArtifact(artifact),/unsupported-module-type/);
});
