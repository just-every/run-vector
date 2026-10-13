import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from "@tanstack/react-router";
import { SavedViewPage } from "../core/features/views/ui/saved-view-page";
export const Route = createFileRoute("/app/views/$viewId")({
  component: editorLeaf(SavedViewPage),
});
