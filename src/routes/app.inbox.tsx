import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from "@tanstack/react-router";
import { InboxPageView } from "../core/features/notifications/ui/inbox-page";
export const Route = createFileRoute("/app/inbox")({
  component: editorLeaf(InboxPageView),
});
