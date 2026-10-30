import type { RunData } from '../base/run-site'
import { runPricing } from '../base/run-pricing'

export const run: RunData = {
  name: 'Vector',
  repository: 'https://github.com/just-every/run-vector',
  clone: 'npx -y @runeditrun/rer dev just-every/run-vector',
  licence: 'MIT',
  docs: true,
  paths: { product: null },
  pricing: runPricing,
}
