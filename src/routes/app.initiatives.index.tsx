import {createFileRoute} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {InitiativesPage} from '../core/features/initiatives/ui/initiatives';
export const Route=createFileRoute('/app/initiatives/')({component:editorLeaf(InitiativesPage)});
