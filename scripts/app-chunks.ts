import type { Plugin } from 'vite'

export function appChunks(): Plugin {
  return {
    name: 'vector:app-chunks',
    apply: 'build',
    applyToEnvironment: environment => environment.name === 'client',
    config() { return { environments: { client: { build: { rolldownOptions: {
      // The workspace already loads these modules together. Deliver them once
      // instead of serial route facades and many competing small requests.
      output: { strictExecutionOrder: true, codeSplitting: false },
    } } } } } },
  }
}
