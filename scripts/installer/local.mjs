import { localInstaller } from '../base-onboarding/adapter.mjs';
import { installOperator } from '../base-onboarding/operator-install.mjs';
import { ensureDevKey } from '../base-cli/cli/dev-identity.mjs';
import { commandAdapter as createCommandAdapter } from '../base-cli/cli/adapter.mjs';
import { developmentTarget, previewTarget } from '../base-onboarding/operator-installer.mjs';
import { portability } from '../data/local.mjs';
import { settings, migrate } from './definition.mjs';
import { features } from './ui/seed.mjs';
import { isolatedStore } from '../installer-env.mjs';
import { hosting, deploy } from './hosting.mjs';
import { guardLocalState } from './state.mjs';
import { recordDevelopmentOrigin } from '../development-origin.mjs';
export const hooks = {
 features, node: '22.20.0', guard: guardLocalState, secrets: settings,
 build: ['pnpm', ['run', 'build:source']], migrate,
 // Setup's temporary app is the production runtime preview uses: no trigger handlers or Local Explorer answer on the public port, and the dev key reaches its outbox.
 start: previewTarget,
 // The installer page takes the same route as rer setup: the checkout's dev key exists before the temporary app starts,
 // so its outbox answers the sign-in request this flow makes.
 prepare: async context => { context.devKey ??= await ensureDevKey(context.root); context.store.addSecrets?.([context.devKey]); },
 owner: async ({ store }) => { await store.step('Configured first owner and workspace are ready'); },
 signIn: { emailKey: 'FIRST_OWNER_EMAIL', returnTo: '/setup' }, hosting,
};
const shared = localInstaller(hooks);
export const adapter = { ...shared, run: (root, input, store, onApp, signal, options) => shared.run(root, input, isolatedStore(store), onApp, signal, options) };
export const install = async (root, input, store, onApp, signal) => {
 // A local workspace installs through the public commands, as Base's operator installer does (rer install,
 // rer setup --answers, rer preview), so its runtime only ever answers behind rer's traffic proxy.
 if (input.target !== 'remote') return installOperator(root, input, isolatedStore(store), onApp, signal, hooks);
 await shared.install(root, input, isolatedStore(store), onApp, signal);
 // A dev-identity seed's outbox needs the key exchange: the installer page offers it through /api/open-app once this is set.
 if (store.state.phase === 'complete' && !store.state.hostedUrl) store.state.devOpen = true;
};
export const commandAdapter = createCommandAdapter(adapter, {
 dev: async context => { await recordDevelopmentOrigin(context.root, context.origin); return developmentTarget(context); },
 preview: previewTarget, verify: ['pnpm', ['run', 'verify:app']], deploy,
 portability,
 // The production build rewrites the router's generated tree; preview must not read that as a source edit.
 generatedOutputs: ['src/routeTree.gen.ts'],
 // Local dev identity: the local-only Worker entry, the build output rer build scans for the dev layer, and the kept end-to-end email-link test.
 devIdentity: { entry: 'src/core/app/worker.dev.ts', output: ['dist'], emailLinkTest: 'tests/e2e/base-auth-runtime.mjs' },
 localOnlyKeys: ['RER_DEV_ORIGIN', 'RER_DEV_IDENTITY'],
 setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs', product: 'Vector',
 input: { names: { email: 'FIRST_OWNER_EMAIL', name: 'FIRST_OWNER_NAME' }, defaults: async () => ({ target: 'local' }) },
});
