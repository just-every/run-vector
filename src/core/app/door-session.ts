import { createServerFn } from '@tanstack/react-start';

export const loadDoorSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { admittedDocumentOperator } = await import('./document-operator.server');
  const document = admittedDocumentOperator();
  if (document) return Boolean(document.operator);
  const { env } = await import('cloudflare:workers');
  const { getRequest } = await import('@tanstack/react-start/server');
  const { requireOperator } = await import('../features/auth/service');
  const { requestBindings } = await import('./request-bindings.server');
  return Boolean(await requireOperator(requestBindings(env), getRequest(), true));
});
