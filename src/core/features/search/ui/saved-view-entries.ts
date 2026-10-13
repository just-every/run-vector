import type { z } from "zod";
import type { PaletteEntry, workspaceSearchSchema } from "./data.ts";

// The server has already filtered private views by the requesting operator.
// Keep that authorized result intact when composing it into the palette.
export function savedViewPaletteEntries(
  search: z.output<typeof workspaceSearchSchema> | null,
  query: string,
): PaletteEntry[] {
  if (!query.trim() || !search) return [];
  return search.savedViews.map((view) => ({
    id: `view:${view.id}`,
    group: "Saved views",
    title: view.name,
    detail: view.isShared ? "Shared saved view" : "Private saved view",
    destination: "/app/views/$viewId",
    params: { viewId: view.id },
  }));
}
