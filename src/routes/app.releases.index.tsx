import {createFileRoute} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {ReleasesPage} from '../core/features/releases/ui/releases';
export const Route=createFileRoute('/app/releases/')({component:editorLeaf(ReleasesPage)});
