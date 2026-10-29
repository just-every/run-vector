import { createFileRoute } from "@tanstack/react-router";
import { editorLeaf } from "../core/editor/leaf";
import { CalendarPage } from "../core/features/calendar-feeds/page";
import { requireCalendarPage } from "../core/features/calendar-feeds/page-access";
export const Route = createFileRoute("/app/calendar")({
  validateSearch: (search: Record<string, unknown>) => (search.view === "timeline" ? { view: "timeline" as const } : {}),
  server: { handlers: { GET: async ({ request, next }) => {
    const { admitCalendarDocument } = await import("../core/features/calendar-feeds/document.server");
    return await admitCalendarDocument(request) ?? next();
  } } },
  beforeLoad: () => requireCalendarPage(),
  component: editorLeaf(CalendarPage),
});
