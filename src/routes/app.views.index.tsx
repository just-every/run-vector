import { createFileRoute } from '@tanstack/react-router';
import { editorLeaf } from '../core/editor/leaf';
import { SavedViewNavigation } from '../core/features/views/ui/saved-views';
export const Route = createFileRoute('/app/views/')({ component: editorLeaf(() =>
  <main className="issues-browser"><h1>Saved views</h1><SavedViewNavigation /></main>),
});
