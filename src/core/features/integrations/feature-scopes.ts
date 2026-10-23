import {tokenScopes as coreScopes} from './scopes';
import {releaseScopes} from '../releases/scopes';
/** Additive feature registration leaves the shared core registry unchanged. */
export const tokenScopes=[...coreScopes,...releaseScopes] as const;
