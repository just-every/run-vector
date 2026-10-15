import docs from '../../docs/site.json' with { type: 'json' };
import { localInstaller } from '@runeditrun/rer/local-installer';
import { installOperator } from '@runeditrun/rer/operator-install';
import { ensureDevKey } from '@runeditrun/rer/dev-identity';
import { commandAdapter as createCommandAdapter } from '@runeditrun/rer/adapter';
import { developmentTarget, previewTarget } from '@runeditrun/rer/operator-installer';
import { portability } from '../data/local.mjs';
import { settings, migrate } from './definition.mjs';
import { features } from './ui/seed.mjs';
import { isolatedStore } from '../installer-env.mjs';
import { deploy } from './hosting.mjs';
import { guardLocalState } from './state.mjs';
import { recordDevelopmentOrigin } from '../development-origin.mjs';
export const hooks = {
 features, node: '22.20.0', guard: guardLocalState, secrets: settings,
 build: ['pnpm', ['run', 'build:source']], migrate,
 // Local setup uses the dev entry for owner proof and automatic entry.
 start: developmentTarget,
 prepare: async context => { context.devKey ??= await ensureDevKey(context.root); context.store.addSecrets?.([context.devKey]); },
 owner: { returnTo: '/setup', displayName: input => input.FIRST_OWNER_NAME || 'Owner' },
 signIn: { emailKey: 'FIRST_OWNER_EMAIL', returnTo: '/setup' },
};
const shared = localInstaller(hooks);
// FIRST_OWNER_NAME is already declared by the manifest; the generic installer
// displayName input would ask for the same owner's name a second time.
export const adapter = { ...shared, ownerBootstrap: false, run: (root, input, store, onApp, signal, options) => shared.run(root, input, isolatedStore(store), onApp, signal, options) };
export const install = async (root, input, store, onApp, signal) => {
 // A local workspace installs through the public commands, as Base's operator installer does (rer install,
 // rer setup --answers, rer preview), so its runtime only ever answers behind rer's traffic proxy.
 if (input.target && input.target !== 'local') throw Error('The browser installer supports this computer only. Use rer deploy for owner-account deployment.');
 return installOperator(root, input, isolatedStore(store), onApp, signal, hooks);
};
export const commandAdapter = createCommandAdapter(adapter, {
 dev: async context => { await recordDevelopmentOrigin(context.root, context.origin); return developmentTarget(context); },
 preview: previewTarget, verify: ['pnpm', ['run', 'verify:build']], deploy,
 portability,
 // The production build rewrites the router's generated tree; preview must not read that as a source edit.
 generatedOutputs: ['src/routeTree.gen.ts'],
 publicPages: ['/', '/signin', '/docs', ...docs.sections.flatMap(section => section.pages.map(page => '/docs/' + page.slug))],
 site: { entry: 'src/site/pages.tsx', output: 'dist/site', declaration: 'deploy-site.json', config: 'vite.site.config.ts' },
 // Local dev identity stays in this entry; rer build scans dist for leakage.
 devIdentity: { entry: 'src/core/app/worker.dev.ts', output: ['dist'] },
 localOnlyKeys: ['RER_DEV_ORIGIN', 'RER_DEV_IDENTITY'],
 setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs', product: 'Vector',
 input: { names: { email: 'FIRST_OWNER_EMAIL', name: 'FIRST_OWNER_NAME' } },
});
