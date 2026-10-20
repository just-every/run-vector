// Keep the serial public command and independent CI runners on the same wall.
export const buildCommands = [
  'sources:verify-base', 'check', 'build', 'integration:check', 'artifact:delivery',
];

export const ciCommands = [
  'sources:verify-base', 'check', 'test:installer', 'test:archive-upgrade', 'test:markdown',
  'test:worker', 'test:deployment', 'test:public-site', 'build',
  'integration:check', 'test:runtime', { node: ['tests/e2e/cycle-schedule-runtime.mjs'] }, { node: ['tests/e2e/personal-time-runtime.mjs'] }, { node: ['tests/e2e/cycle-report-runtime.mjs'] }, { node: ['tests/e2e/project-report-runtime.mjs'] }, { node: ['tests/e2e/issue-copy-runtime.mjs'] }, { node: ['tests/e2e/related-runtime.mjs'] }, { node: ['tests/e2e/current-intake-runtime.mjs'] }, { node: ['tests/e2e/theme-runtime.mjs'] }, { node: ['tests/e2e/housekeeping-runtime.mjs'] }, 'artifact:delivery', 'test:wave-b',
  'test:data', 'test:integrations', 'test:base-auth', 'test:access',
  'test:mutation-refresh', 'test:admin', 'test:collaboration',
];

// Keep the longest journeys first and avoid a long tail of queued runners.
// The 18-runner plan spent over six minutes queueing its nine-minute archive
// journey. Nine runners retain every command and fresh build. Hosted artifact
// checks have their own budget so the native runtime journey fits its limit.
// Each runtime runner owns its own output, D1/R2 installations and browsers.
export const verificationShards = {
  // test:data is its two existing entry points, split without omitting either.
  imports: {
    browser: true, native: true,
    commands: ['build', { node: ['tests/e2e/data-runtime.mjs'] }],
  },
  portability: {
    browser: true, native: true,
    commands: ['build', { node: ['--import', './tests/e2e/integrations/register-loader.mjs', 'tests/e2e/data-roundtrip.mjs'] }],
  },
  runtime: {
    browser: true,
    commands: ['sources:verify-base', 'check', 'test:installer', 'test:markdown',
      'test:deployment', 'build', 'test:runtime', { node: ['tests/e2e/cycle-schedule-runtime.mjs'] }, { node: ['tests/e2e/personal-time-runtime.mjs'] }, { node: ['tests/e2e/cycle-report-runtime.mjs'] }, { node: ['tests/e2e/project-report-runtime.mjs'] }, { node: ['tests/e2e/issue-copy-runtime.mjs'] }, { node: ['tests/e2e/related-runtime.mjs'] }],
  },
  administration: {
    browser: true, native: true,
    commands: ['build', 'test:admin', 'build', 'test:collaboration',
      'build', 'test:dev:ci'],
  },
  ownership: {
    browser: true,
    // The high-volume intake fixture has its own installation and operator;
    // sharing it with keyboard journeys spends their normal request budget.
    commands: ['build', { node: ['tests/e2e/current-intake-runtime.mjs'] }, { node: ['tests/e2e/theme-runtime.mjs'] }, { node: ['tests/e2e/housekeeping-runtime.mjs'] }, 'test:wave-b', 'test:base-auth',
      'build', 'test:access', 'test:mutation-refresh', 'build', 'test:integrations'],
  },
  'hosted-artifact': {
    browser: true,
    commands: ['test:public-site', 'verify'],
  },
  // Keep Vitest's complete six-file-partition wall, balanced across three
  // runners. Each invocation still gets its original isolated Vitest process.
  'worker-1': { commands: [['test:worker', '--shard=4/6'], ['test:worker', '--shard=5/6']] },
  'worker-2': { commands: [['test:worker', '--shard=2/6'], ['test:worker', '--shard=3/6'], 'test:archive-upgrade'] },
  'worker-3': { commands: [['test:worker', '--shard=1/6'], ['test:worker', '--shard=6/6']] },
};

// The hosted-artifact shard's rer verify remains the public door for the adapter's full
// build checks and Base's hosted artifact and hydration boundaries.
export const verificationMatrix = Object.entries(verificationShards).map(([shard, plan]) => ({
  shard, browser: plan.browser ?? false, native: plan.native ?? false,
}));
