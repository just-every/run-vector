import { z } from 'zod';
import { tokenScopes } from './tokens';
const nativeId=z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
export const tokenInput=z.object({name:z.string().trim().min(1).max(200),scopes:z.array(z.enum(tokenScopes)).min(1).max(tokenScopes.length).refine(value=>new Set(value).size===value.length),expiresAt:z.number().int().positive().optional()}).strict();
export const sourceConfigInput=z.object({sourceId:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/),name:z.string().trim().min(1).max(120),teamId:nativeId}).strict();
export const rotationInput=z.object({overlapHours:z.number().int().min(0).max(24)}).strict();
export const destinationInput=z.object({name:z.string().trim().min(1).max(120),url:z.string().min(1).max(2000)}).strict();
export const githubInput=z.object({repository:z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(200),name:z.string().trim().min(1).max(120)}).strict();
