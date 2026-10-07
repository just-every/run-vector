export type CycleProgressIssue = {
  category: string;
  estimate: number | null;
};

export type CycleProgress = {
  completed: number;
  total: number;
  unit: "points" | "issue-count";
  percentage: number | null;
  capacity: number | null;
  capacityRisk: "unknown" | "at-risk" | "within-capacity";
  remainingPoints: number | null;
  unestimatedRemaining: number;
};

/** Live committed scope only; this calculation never changes closure history. */
export function calculateCycleProgress(
  issues: readonly CycleProgressIssue[],
  capacity: number | null,
): CycleProgress {
  const included = issues.filter(
    (issue) => !["canceled", "duplicate"].includes(issue.category),
  );
  const completed = included.filter((issue) => issue.category === "completed");
  const remaining = included.filter((issue) => issue.category !== "completed");
  const usePoints = included.every((issue) => issue.estimate !== null);
  const scope = (items: readonly CycleProgressIssue[]) =>
    usePoints
      ? items.reduce((total, issue) => total + (issue.estimate as number), 0)
      : items.length;
  const total = scope(included);
  const completedScope = scope(completed);
  const unestimatedRemaining = remaining.filter(
    (issue) => issue.estimate === null,
  ).length;
  const remainingPoints =
    unestimatedRemaining > 0
      ? null
      : remaining.reduce(
          (total, issue) => total + (issue.estimate as number),
          0,
        );
  return {
    completed: completedScope,
    total,
    unit: usePoints ? "points" : "issue-count",
    percentage: included.length === 0 ? null : (completedScope / total) * 100,
    capacity,
    capacityRisk:
      capacity === null || remainingPoints === null
        ? "unknown"
        : remainingPoints > capacity
          ? "at-risk"
          : "within-capacity",
    remainingPoints,
    unestimatedRemaining,
  };
}
