import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isViteDevelopmentAsset } from '../src/core/app/vite-development-path.ts'

test('mention markdown admits its reviewed optimized decoder and shared browser chunk', () => {
  const source = readFileSync(new URL('../src/core/features/notifications/mention-markdown.ts', import.meta.url), 'utf8')
  assert.match(source, /import \{ decodeString \} from "micromark-util-decode-string";/)
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.dependencies['micromark-util-decode-string'], '2.0.1')

  // The development export selected by Vite uses these character decoders
  // and symbol constants. The named decoder selects its DOM browser export.
  const decoderPackage = new URL('../node_modules/micromark-util-decode-string/', import.meta.url)
  const decoderManifest = JSON.parse(readFileSync(new URL('package.json', decoderPackage), 'utf8'))
  assert.equal(decoderManifest.exports.development, './dev/index.js')
  const decoder = readFileSync(new URL('dev/index.js', decoderPackage), 'utf8')
  for (const dependency of [
    'decode-named-character-reference',
    'micromark-util-decode-numeric-character-reference',
    'micromark-util-symbol',
  ]) assert.ok(decoder.includes(`from '${dependency}'`), dependency)

  for (const pathname of [
    '/node_modules/.vite/deps/micromark-util-decode-string.js',
    '/node_modules/.vite/deps/dev-Cqu_Xnum.js',
  ]) assert.equal(isViteDevelopmentAsset(pathname), true, pathname)
})

test('decoder review grants no optimized namespace, source map or filesystem access', () => {
  for (const pathname of [
    '/node_modules/.vite/deps/dev-unreviewed.js',
    '/node_modules/.vite/deps/micromark-util-decode-string.js.map',
    '/node_modules/.vite/deps/dev-Cqu_Xnum.js.map',
    '/node_modules/.vite/deps/_metadata.json',
    '/node_modules/.vite/deps/mentions.server.js',
    '/node_modules/.vite/deps/repository.js',
    '/node_modules/micromark-util-decode-string/dev/index.js',
    '/@fs/node_modules/.vite/deps/dev-Cqu_Xnum.js',
    '/src/core/features/notifications/mentions.server.ts',
    '/src/core/features/notifications/repository.ts',
    '/src/core/features/notifications/mail.ts',
  ]) assert.equal(isViteDevelopmentAsset(pathname), false, pathname)
})
