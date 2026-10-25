import { createFileRoute } from '@tanstack/react-router';
import { editorLeaf } from '../core/editor/leaf';
import { SavedViewNavigation } from '../core/features/views/ui/saved-views';
import '../core/features/issues/ui/issues-browser.css';
export const Route = createFileRoute('/app/views/')({ component: editorLeaf(SavedViewsIndex) });
function SavedViewsIndex() {
  return <main className="issues-browser"><header className="issues-heading"><div><h1>Saved views</h1></div></header><SavedViewNavigation /></main>;
}
