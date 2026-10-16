import type { RunData } from '../base/run-site'

export const run: RunData = {
  name: 'Vector',
  repository: 'https://github.com/just-every/run-vector',
  clone: 'npx -y @runeditrun/rer dev just-every/run-vector',
  folder: 'run-vector',
  requirements: 'Needs Git and Node 22 or later, on macOS, Linux or Windows with WSL2. rer provides the pinned Node and pnpm.',
  licence: 'MIT',
  docs: true,
  hosted: [],
}
