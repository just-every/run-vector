import type { WorkerBindings } from './bindings';
declare const __VECTOR_DEV_ORIGIN__: string;

/** Vite's server-function runner imports its own Workers env module. Apply the
 * launcher's explicit origin there too; a request can never choose this value. */
export function requestBindings(env: WorkerBindings): WorkerBindings {
  return import.meta.env.DEV && typeof __VECTOR_DEV_ORIGIN__ !== 'undefined' && __VECTOR_DEV_ORIGIN__
    ? { ...env, APP_ORIGIN: __VECTOR_DEV_ORIGIN__ } : env;
}
