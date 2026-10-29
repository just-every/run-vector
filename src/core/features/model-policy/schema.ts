import { z } from 'zod';
export const features = ['triage', 'semantic-search', 'ask', 'drafting'] as const;
export const featureNames = {triage:'Triage suggestions', 'semantic-search':'Semantic search', ask:'Ask Vector', drafting:'Drafting'};
export const categories = ['issue identifier', 'issue title', 'issue description'] as const;
const https = z.url().max(1000).refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search;
}, 'Use an HTTPS URL without credentials, query or fragment.');
export const providerInput = z.object({
  name:z.string().trim().min(1).max(100), kind:z.enum(['anthropic','self-hosted']),
  endpoint:https, model:z.string().trim().min(1).max(120),
  credential:z.string().min(1).max(4096).refine(value => !/[\r\n]/.test(value)),
}).strict().refine(value => value.kind !== 'anthropic' || value.endpoint === 'https://api.anthropic.com/v1/messages', 'Use the declared Anthropic endpoint.');
export const credentialInput=z.object({credential:z.string().min(1).max(4096).refine(value=>!/[\r\n]/.test(value))}).strict();
export const confirmationInput = z.object({termsUrl:https, noTraining:z.literal(true), retention:z.string().trim().min(1).max(500)}).strict();
export const policyInput = z.object({feature:z.enum(features), teamId:z.string().length(26).nullable(), enabled:z.boolean(), providerId:z.string().length(26).nullable()}).strict();
const provider = z.object({id:z.string(),name:z.string(),kind:z.enum(['anthropic','self-hosted']),endpoint:z.string(),model:z.string(),termsUrl:z.string().nullable(),noTraining:z.boolean(),retention:z.string().nullable(),confirmedAt:z.string().nullable(),ready:z.boolean(),data:z.array(z.string())});
export const modelSettingsSchema = z.object({providers:z.array(provider), policies:z.array(policyInput), features:z.array(z.object({id:z.enum(features),name:z.string(),data:z.array(z.string())})), owner:z.boolean()});
export type ModelSettings = z.infer<typeof modelSettingsSchema>;
export const previewSchema = z.object({enabled:z.boolean(),suggestion:z.string().optional(),model:z.string().optional(),records:z.array(z.string()).optional(),at:z.string().optional()});
