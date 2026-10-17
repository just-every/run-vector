import { createFileRoute } from "@tanstack/react-router";
import { editorLeaf } from "../core/editor/leaf";
import { MyActivity } from "../core/features/my-work/ui/activity-page";
export const Route = createFileRoute("/app/my-work/activity")({
  component: editorLeaf(MyActivity),
});
