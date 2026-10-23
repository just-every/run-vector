import {createFileRoute} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {InitiativePage} from '../core/features/initiatives/ui/initiatives';
export const Route=createFileRoute('/app/initiatives/$initiativeId')({component:editorLeaf(Page)});
function Page(){return <InitiativePage id={Route.useParams().initiativeId}/>;}
