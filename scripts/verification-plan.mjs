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

// Keep long journeys first. CI shares the initial production build across the
// runtime shards; each runner still owns its D1/R2 installations and browsers.
// The hosted-artifact shard retains its fresh build/verification boundaries.
// Keep these public-door flows until they can be rebalanced within their budget;
// combining the current long shards would exceed the normal job cap.
const verificationGroups = {
  // test:data is its two existing entry points, split without omitting either.
  imports: {
    browser: true, native: true,
    commands: ['build', { node: ['tests/e2e/data-runtime.mjs'] }, { node: ['tests/e2e/related-runtime.mjs'] }, { node: ['tests/e2e/issue-copy-runtime.mjs'] }],
  },
  portability: {
    browser: true, native: true,
    commands: ['build', { node: ['--import', './tests/e2e/integrations/register-loader.mjs', 'tests/e2e/data-roundtrip.mjs'] }],
  },
  runtime: {
    browser: true,
    commands: ['sources:verify-base', 'check', 'test:installer', 'test:markdown',
      'test:deployment', 'build', { node: ['tests/e2e/cycle-schedule-runtime.mjs'] }, { node: ['tests/e2e/personal-time-runtime.mjs'] }, { node: ['tests/e2e/cycle-report-runtime.mjs'] }, { node: ['tests/e2e/project-report-runtime.mjs'] }],
  },
  // Keep every core journey and shared public-door assertion inside the normal
  // job budget. The serial test:runtime entry point still runs both groups.
  'core-runtime': {
    browser: true, native: true,
    commands: ['build', { node: ['tests/e2e/core-runtime.mjs', 'current'] }],
  },
  'core-runtime-planning': {
    browser: true, native: true,
    commands: ['build', { node: ['tests/e2e/core-runtime.mjs', 'planning'] }],
  },
  administration: {
    browser: true, native: true,
    commands: ['build', 'test:admin'],
  },
  collaboration: {
    browser: true, native: true,
    commands: ['build', 'test:collaboration'],
  },
  development: {
    browser: true, native: true,
    commands: ['build', 'test:dev:ci'],
  },
  ownership: {
    browser: true,
    // The high-volume intake fixture has its own installation and operator;
    // sharing it with keyboard journeys spends their normal request budget.
    commands: ['build', { node: ['tests/e2e/current-intake-runtime.mjs'] }, { node: ['tests/e2e/theme-runtime.mjs'] }, { node: ['tests/e2e/housekeeping-runtime.mjs'] }, 'test:wave-b', 'test:base-auth'],
  },
  'hosted-artifact': {
    browser: true,
    // Own the former ownership tail; retain each fresh build boundary.
    commands: ['test:public-site', 'verify', 'build', 'test:access', 'test:mutation-refresh', 'build', 'test:integrations'],
  },
  // Keep Vitest's complete six-file-partition wall, balanced across three
  // runners. Each invocation still gets its original isolated Vitest process.
  'worker-1': { commands: [['test:worker', '--shard=4/6'], ['test:worker', '--shard=5/6']] },
  'worker-2': { commands: [['test:worker', '--shard=2/6'], ['test:worker', '--shard=3/6']] },
  'worker-3': { commands: [['test:worker', '--shard=1/6'], ['test:worker', '--shard=6/6']] },
  // Authentic historical restores run independently of the worker partitions.
  'archive-upgrade': { native: true, commands: ['test:archive-upgrade'] },
};

// Pair independent groups by their measured CI cost. Reuse the shared build
// once per ordinary job; the hosted-artifact producer keeps every fresh build.
function combineGroups(names, { retainBuilds = false } = {}) {
  let built = false;
  return {
    browser: names.some(name => verificationGroups[name].browser),
    native: names.some(name => verificationGroups[name].native),
    commands: names.flatMap(name => verificationGroups[name].commands).filter(command => {
      if (command !== 'build' || retainBuilds) return true;
      if (built) return false;
      built = true;
      return true;
    }),
  };
}

export const verificationShards = {
  imports: combineGroups(['worker-1', 'imports']),
  portability: combineGroups(['worker-3', 'portability']),
  'core-runtime': verificationGroups['core-runtime'],
  'core-runtime-planning': verificationGroups['core-runtime-planning'],
  administration: combineGroups(['administration', 'ownership']),
  collaboration: combineGroups(['collaboration', 'runtime']),
  'worker-2': combineGroups(['worker-2', 'development']),
  'hosted-artifact': combineGroups(['hosted-artifact', 'archive-upgrade'], { retainBuilds: true }),
};

// The hosted-artifact shard's rer verify remains the public door for the adapter's full
// build checks and Base's hosted artifact and hydration boundaries.
export const verificationMatrix = Object.entries(verificationShards).map(([shard, plan]) => ({
  shard, browser: plan.browser ?? false, native: plan.native ?? false,
  prebuilt: plan.commands.includes('build') && shard !== 'hosted-artifact',
}));
