import { createServerFn } from '@tanstack/react-start';

export const loadDoorSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { currentOperator } = await import('./request.server');
  return Boolean(await currentOperator());
});
