import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicPath } from '../src/core/app/public-paths.ts'
import { isViteDevelopmentAsset } from '../src/core/app/vite-development-path.ts'

test('the public paths leave the operator shell behind the session gate', () => {
  assert.equal(isPublicPath('/app'), false)
})

test('the health endpoint is not an asset fallback', () => {
  assert.equal(isPublicPath('/health'), true)
})

test('development Vite modules have an explicit asset-forwarding allowlist', () => {
  assert.equal(isViteDevelopmentAsset('/src/main.tsx'), true)
  assert.equal(isViteDevelopmentAsset('/@vite/client'), true)
  assert.equal(isViteDevelopmentAsset('/node_modules/.vite/deps/react.js'), true)
  assert.equal(isViteDevelopmentAsset('/not-public'), false)
  assert.equal(isViteDevelopmentAsset('/@unreviewed'), false)
  assert.equal(isViteDevelopmentAsset('/src/core/app/request.server.ts'), false)
  assert.equal(isViteDevelopmentAsset('/node_modules/unreviewed.js'), false)
  assert.equal(isViteDevelopmentAsset('/_serverFn/private'), false)
})
