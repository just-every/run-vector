import type { PaletteEntry, workspaceSearchSchema } from "../search/ui/data";

type Search = ReturnType<typeof workspaceSearchSchema.parse> | null;
/** An explicit action prefix keeps ordinary issue searches as one row per issue. */
export function copySearchTerm(query: string): string | null {
  const match = /^copy\s+issue(?:\s+(.*))?$/i.exec(query.trim());
  return match ? (match[1]?.trim() ?? "") : null;
}
export function copyPaletteEntries(
  identifier: string | undefined,
  search: Search,
  query: string,
): PaletteEntry[] {
  const term = query.trim().toLocaleLowerCase(),
    explicit = copySearchTerm(query);
  if (explicit === null && term !== "copy" && term !== "") return [];
  const target = explicit?.toLocaleLowerCase() ?? "";
  const candidates = [
    ...(explicit !== null ? (search?.issues ?? []) : []),
    ...(identifier ? [{ identifier, title: "Current issue" }] : []),
  ];
  return candidates
    .filter(
      (issue, index) =>
        candidates.findIndex(
          (other) => other.identifier === issue.identifier,
        ) === index,
    )
    .filter(
      (issue) =>
        !target ||
        `${issue.identifier} ${issue.title}`
          .toLocaleLowerCase()
          .includes(target),
    )
    .map((issue) => ({
      id: `copy:${issue.identifier}`,
      group: "Commands",
      title: `Copy issue ${issue.identifier}`,
      detail: issue.title,
      destination: "/app/issues/$identifier",
      params: { identifier: issue.identifier },
      action: "copy-issue",
    }));
}
