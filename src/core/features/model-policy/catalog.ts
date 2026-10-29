import seed from '../../../../seed.json';
import { categories } from './schema';
/** A provider declaration is published product configuration, never inferred from a URL. */
export function declaredProvider(kind:string) {
  if (kind !== 'anthropic') return null;
  const entry=seed.externals.find(entry => entry.id === 'anthropic-model-api');
  if(!entry?.termsUrl || !entry.noTraining || !entry.noTrainingStatement || !entry.retention || !categories.every(category=>entry.data.includes(category)))return null;
  try { if(new URL(entry.termsUrl).protocol!=='https:')return null; } catch {return null;}
  return entry;
}
export function providerDisclosure(row:{kind:string;terms_url:string|null;retention:string|null;confirmed_at:string|null}) {
  const declared = declaredProvider(row.kind);
  return {termsUrl:row.terms_url ?? declared?.termsUrl ?? null,
    noTraining:Boolean(row.confirmed_at) || declared?.noTraining === true,
    retention:row.retention ?? declared?.retention ?? null, data:[...categories]};
}
