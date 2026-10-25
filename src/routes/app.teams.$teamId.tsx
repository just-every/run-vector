import {createFileRoute} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {TeamDocumentsPage} from '../core/features/documents/ui/list';
export const Route=createFileRoute('/app/teams/$teamId')({component:editorLeaf(Page)});
function Page(){return <TeamDocumentsPage teamId={Route.useParams().teamId}/>;}
