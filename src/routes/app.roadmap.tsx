import {createFileRoute} from '@tanstack/react-router';
import {editorLeaf} from '../core/editor/leaf';
import {RoadmapPage} from '../core/features/roadmap/page';
export const Route=createFileRoute('/app/roadmap')({component:editorLeaf(RoadmapPage)});
