import { createFileRoute } from '@tanstack/react-router';
import { loadFirstRun } from '../core/features/first-run/loader';
import { FirstRunPage } from '../core/features/first-run/page';
export const Route=createFileRoute('/setup')({loader:()=>loadFirstRun(),component:Setup});
function Setup() {return <FirstRunPage state={Route.useLoaderData()}/>;}
