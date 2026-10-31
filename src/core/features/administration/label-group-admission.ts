/** Label groups: at most one label of a group on an issue. Every issue writer
 * checks readably first, and the 0121 triggers refuse the same state inside the
 * writing transaction, so a concurrent group change cannot slip through. */
export const labelGroupConflictMessage = (group: string) => `Choose at most one label from the ${group} group.`;
export const labelGroupRaceMessage = "A label group changed while this was saved. Refresh labels and choose again.";
export const isLabelGroupConflict = (error: unknown) => /label_group_conflict/.test(String(error));

/** The first group (by name) holding two or more of these labels, or null. */
export function crowdedGroupName(labels: { id: string; groupId: string | null }[], groups: { id: string; name: string }[]) {
  const seen = new Set<string>(), crowded = new Set<string>();
  for (const label of labels) if (label.groupId) (seen.has(label.groupId) ? crowded : seen).add(label.groupId);
  return groups.filter((group) => crowded.has(group.id)).map((group) => group.name).sort()[0] ?? null;
}

/** Import rows resolve labels from one preloaded read of labels with their group names. */
export function crowdedGroupInRows(rows: { id: string; group_id?: unknown; group_name?: unknown }[], labelIds: string[]) {
  const chosen = labelIds.flatMap((id) => rows.filter((row) => row.id === id && typeof row.group_id === "string"));
  return crowdedGroupName(
    chosen.map((row) => ({ id: row.id, groupId: row.group_id as string })),
    chosen.map((row) => ({ id: row.group_id as string, name: String(row.group_name) })),
  );
}
