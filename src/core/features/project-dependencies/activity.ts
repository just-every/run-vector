type Edge = { blockedProjectId: string; blockingProjectId: string };
type Entry = { kind: string; previousValue: unknown; nextValue: unknown };
export type DependencyActivity = {
  direction: 'blocked-by' | 'blocking';
  project: { id: string; name: string } | null;
};

/** Each endpoint's activity names the other endpoint from the reader's own
 * visible projects. The visibility projection already withholds an entry that
 * mentions a hidden project, so a missing name means a deleted project. */
export function dependencyActivity<T extends Entry>(entries: T[], projectId: string, projects: { id: string; name: string }[]) {
  const names = new Map(projects.map(project => [project.id, project.name]));
  return entries.map((entry): T & { dependency?: DependencyActivity } => {
    if (entry.kind !== 'project.dependency_added' && entry.kind !== 'project.dependency_removed') return entry;
    const edge = (entry.kind === 'project.dependency_added' ? entry.nextValue : entry.previousValue) as Edge;
    const blockedBy = edge.blockedProjectId === projectId;
    const other = blockedBy ? edge.blockingProjectId : edge.blockedProjectId;
    const name = names.get(other);
    return { ...entry, dependency: { direction: blockedBy ? 'blocked-by' : 'blocking', project: name === undefined ? null : { id: other, name } } };
  });
}
