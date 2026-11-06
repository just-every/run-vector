import { AsyncLocalStorage } from 'node:async_hooks';

export type AppActor = {
 id: string; workspace: string; namespace: string; tokenId: string; scopes: readonly string[];
 app: { id: string; name: string; installerName: string | null; teamId: string; identifier?: string };
};
const context = new AsyncLocalStorage<AppActor>();
export const currentAppActor = () => context.getStore();
export const asAppActor = <T>(actor: AppActor, run: () => Promise<T>) => context.run(actor, run);
export const appActorLabel = (name: string, installer: string | null) => name + ' · installed by ' + (installer ?? 'Erased person');
