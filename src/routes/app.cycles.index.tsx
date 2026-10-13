import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from "@tanstack/react-router";
import { CyclesWorkspace } from "../core/features/cycles/ui/cycles-workspace";
export const Route = createFileRoute("/app/cycles/")({
  component: editorLeaf(CyclesWorkspace),
});
