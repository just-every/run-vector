import { editorLeaf } from '../core/editor/leaf';
import { createFileRoute } from "@tanstack/react-router";
import { CycleDetailPage } from "../core/features/cycles/ui/cycle-detail";
export const Route = createFileRoute("/app/cycles/$cycleId")({
  component: editorLeaf(CycleRoute),
});
function CycleRoute() {
  const { cycleId } = Route.useParams();
  return <CycleDetailPage cycleId={cycleId} />;
}
