import {createFileRoute} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {DocumentPage} from '../core/features/documents/ui/page';
export const Route=createFileRoute('/app/documents/$documentId')({component:editorLeaf(Page)});
function Page(){return <DocumentPage documentId={Route.useParams().documentId}/>;}
