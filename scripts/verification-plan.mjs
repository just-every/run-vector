// Keep the serial public command and independent CI runners on the same wall.
export const buildCommands = [
  'sources:verify-base', 'check', 'build', 'integration:check', 'artifact:delivery',
];

export const ciCommands = [
  'sources:verify-base', 'check', 'test:installer', 'test:markdown',
  'test:worker', 'test:deployment', 'test:public-site', 'build',
  'integration:check', 'test:runtime', 'artifact:delivery', 'test:wave-b',
  'test:data', 'test:integrations', 'test:base-auth', 'test:access',
  'test:mutation-refresh', 'test:admin', 'test:collaboration',
];

// Each runtime runner builds its own output and owns its D1/R2 and browsers.
// test:data is its two existing entry points, split without omitting either.
export const verificationShards = {
  source: {
    commands: ['sources:verify-base', 'check', 'test:installer', 'test:markdown',
      'test:deployment'],
  },
  'worker-1': { commands: [['test:worker', '--shard=1/3']] },
  'worker-2': { commands: [['test:worker', '--shard=2/3']] },
  'worker-3': { commands: [['test:worker', '--shard=3/3']] },
  site: { browser: true, commands: ['test:public-site'] },
  runtime: { browser: true, commands: ['build', 'test:runtime'] },
  // rer verify includes the adapter's full build checks, followed by Base's
  // hosted artifact and hydration boundaries. It must remain the public door.
  delivery: { browser: true, commands: ['verify'] },
  ownership: {
    browser: true,
    commands: ['build', 'test:wave-b', 'test:base-auth', 'test:access', 'test:mutation-refresh'],
  },
  imports: {
    browser: true, native: true,
    commands: ['build', { node: ['tests/e2e/data-runtime.mjs'] }],
  },
  portability: {
    browser: true, native: true,
    commands: ['build', { node: ['--import', './tests/e2e/integrations/register-loader.mjs', 'tests/e2e/data-roundtrip.mjs'] }],
  },
  integrations: { browser: true, commands: ['build', 'test:integrations'] },
  administration: { browser: true, commands: ['build', 'test:admin'] },
  collaboration: { browser: true, commands: ['build', 'test:collaboration'] },
  development: { browser: true, native: true, commands: ['build', 'test:dev:ci'] },
};

export const verificationMatrix = Object.entries(verificationShards).map(([shard, plan]) => ({
  shard, browser: plan.browser ?? false, native: plan.native ?? false,
}));
