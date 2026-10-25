import { createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
export const loadFirstRun = createServerFn({method:'GET'}).handler(async()=> {
  const {currentOperator}=await import('../../app/request.server');
  const operator=await currentOperator();
  if(!operator) throw redirect({to:'/signin',search:{returnTo:'/setup'}});
  const {env}=await import('cloudflare:workers');
  const {firstRunState}=await import('./repository');
  const state=await firstRunState(env.DB,operator.id);
  if(!state.owner) throw redirect({to:'/app'});
  return state;
});
