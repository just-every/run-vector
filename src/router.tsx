import { installCompiledLiveEdits,setLiveEditsReady } from '../vendor/base/editor/index';
import compiled from './editor/visual-edits.json';
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
if(typeof document!=='undefined'){setLiveEditsReady(false);installCompiledLiveEdits(compiled);}
export function getRouter() {
  const router=createRouter({ routeTree, scrollRestoration: true });
  if(typeof document!=='undefined') {
    router.subscribe('onBeforeNavigate',()=>setLiveEditsReady(false));
  }
  return router;
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
