import { createFileRoute } from '@tanstack/react-router';
import { loadFirstRun } from '../core/features/first-run/loader';
import { FirstRunPage } from '../core/features/first-run/page';
import { Door } from '../core/app/site/door/door';
export const Route=createFileRoute('/setup')({loader:()=>loadFirstRun(),component:Setup,errorComponent:()=> <Door><p className="vx-door-lead">Setup could not be opened. <a href="/app">Back to workspace</a></p></Door>});
function Setup() {return <FirstRunPage state={Route.useLoaderData()}/>;}
