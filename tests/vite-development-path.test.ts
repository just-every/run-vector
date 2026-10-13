import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { isViteDevelopmentAsset } from '../src/core/app/vite-development-path.ts'

test('local static imports of the browser router remain available through Vite', () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const pending = [resolve(root, 'src/router.tsx')]
  const reviewed = new Set<string>()
  while (pending.length) {
    const filename = pending.pop()!
    if (reviewed.has(filename)) continue
    reviewed.add(filename)
    const pathname = `/${filename.slice(root.length)}`
    assert.equal(isViteDevelopmentAsset(pathname), true, pathname)

    // Runtime imports and CSS @imports are browser dependencies. Type-only
    // imports and dynamic imports in server-function bodies are not.
    const imports = /\bimport\s+(?:([^;'"]*?)\s+from\s+)?['"](\.[^'"]+)['"]/g
    for (const match of readFileSync(filename, 'utf8').matchAll(imports)) {
      if (match[1]?.trimStart().startsWith('type ')) continue
      const target = resolve(dirname(filename), match[2])
      const dependency = ['', '.tsx', '.ts', '.css']
        .map((extension) => target + extension)
        .find(existsSync)
      assert.ok(dependency, `Unresolved local import ${match[2]} in ${pathname}`)
      pending.push(dependency)
    }
  }
})

test('reviewing UI modules does not expose their private or unreviewed neighbors', () => {
  for (const pathname of [
    '/src/core/app/request.server.ts',
    '/src/core/app/worker.ts',
    '/src/core/features/auth/repository.ts',
    '/src/core/features/issues/repository.ts',
    '/src/core/app/public/unreviewed.tsx',
    '/src/routes/unreviewed.tsx',
    '/_serverFn/private',
  ]) {
    assert.equal(isViteDevelopmentAsset(pathname), false, pathname)
  }
})


test('observed cycle route modules do not expose administration server modules', () => {
  for (const pathname of [
    '/src/routes/app.cycles.index.tsx',
    '/src/routes/app.cycles.$cycleId.tsx',
  ]) assert.equal(isViteDevelopmentAsset(pathname), true, pathname)
  for (const pathname of [
    '/src/core/features/administration/read.ts',
    '/src/core/features/administration/routes.ts',
    '/src/core/features/administration/transaction.ts',
  ]) assert.equal(isViteDevelopmentAsset(pathname), false, pathname)
})
