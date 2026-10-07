import assert from 'node:assert/strict'
import { contract } from './contract.ts'
import { isPublicPath } from '../src/core/app/public-paths.ts'

contract('HOME-001', 'the owner landing and sign-in flow are public', () => {
  assert.equal(isPublicPath('/'), true)
  assert.equal(isPublicPath('/signin'), true)
  assert.equal(isPublicPath('/app'), false)
})
