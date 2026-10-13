import { createHmac } from 'node:crypto';
import { approveSetupDependencies } from '@runeditrun/rer/internal/onboarding/dependency-approval.mjs';

// Vector's configured-owner bootstrap stays intact. Selected links use Base's
// fresh owner approval before the CLI redeems the provider's grant.
export async function approveDependencies(context) {
 const post = (context, path, body) => fetch(new URL(path, context.origin), {
  method: 'POST', redirect: 'manual', signal: context.signal,
  headers: { Origin: context.origin, 'Content-Type': 'application/json',
   'x-rer-local-cli': createHmac('sha256', context.vars.SESSION_SECRET).update('local-cli\0sign-in').digest('hex') },
  body: JSON.stringify(body),
 });
 const messages = async (context, path, address) => {
  const response = await fetch(new URL(path, context.origin), {
   signal: context.signal, headers: context.devKey ? {'x-rer-dev-key': context.devKey} : {},
  });
  if (!response.ok) throw Error('The local sign-in outbox is unavailable for owner approval.');
  const escaped = address.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return (await response.text()).split('<article>').slice(1)
   .filter(article => article.toLowerCase().includes(`To: ${escaped}</p>`.toLowerCase()))
   .map(article => /\?message=([^"&]+)"/.exec(article)?.[1]).filter(Boolean).map(decodeURIComponent);
 };
 await approveSetupDependencies(context, post, messages);
}
