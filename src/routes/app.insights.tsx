import { createFileRoute } from "@tanstack/react-router";
import { editorLeaf } from "../core/editor/leaf";
import { InsightsPage } from "../core/features/insights/page";
import { requireInsightsPage } from "../core/features/insights/page-access";
export const Route = createFileRoute("/app/insights")({
  server: { handlers: { GET: async ({ request, next }) => {
    const { admitInsightDocument } = await import("../core/features/insights/document.server");
    return await admitInsightDocument(request) ?? next();
  } } },
  beforeLoad: () => requireInsightsPage(),
  component: editorLeaf(InsightsPage),
});
