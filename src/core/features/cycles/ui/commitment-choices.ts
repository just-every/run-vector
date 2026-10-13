// A completed issue can retain its historical commitment or be uncommitted;
// only nonterminal issues can acquire a different cycle commitment.
export function canSelectCycle(
  category: string,
  currentCycleId: string | null,
  targetCycleId: string | null,
): boolean {
  return (
    targetCycleId === null ||
    targetCycleId === currentCycleId ||
    !["completed", "canceled", "duplicate"].includes(category)
  );
}

type CommitmentCandidate = {
  team: { id: string };
  status: { category: string };
};

export function eligibleCommitmentIssues<T extends CommitmentCandidate>(
  issues: readonly T[],
  teamId: string,
  teamArchived: boolean,
): T[] {
  if (teamArchived) return [];
  return issues.filter(
    (issue) =>
      issue.team.id === teamId &&
      !["completed", "canceled", "duplicate"].includes(issue.status.category),
  );
}

export function commitmentSearchUrl(search: string): string {
  const query = new URLSearchParams({
    category: "all",
    q: search.trim().slice(0, 200),
  });
  return `/api/issues?${query}`;
}
