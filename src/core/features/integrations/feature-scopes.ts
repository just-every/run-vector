import {tokenScopes as coreScopes} from './scopes';
import {releaseScopes} from '../releases/scopes';
import {initiativeScopes} from '../initiatives/scopes';
/** Additive feature registration leaves the shared core registry unchanged. */
export const tokenScopes=[...coreScopes,...releaseScopes,...initiativeScopes] as const;
