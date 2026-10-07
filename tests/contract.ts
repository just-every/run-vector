import { test } from 'node:test'
type ContractTest = () => void | Promise<void>
export function contract(id: string, name: string, run: ContractTest) {
  return test(`[${id}] ${name}`, run)
}
