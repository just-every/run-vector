export function remainingScopeCopy(
  points: number | null,
  unestimated: number,
): string {
  const estimated = points === null ? "" : `${points} points of work left.`;
  const missing =
    unestimated > 0
      ? `${unestimated} unfinished issue${unestimated === 1 ? " needs" : "s need"} an estimate.`
      : "All unfinished issues have estimates.";
  return [estimated, missing].filter(Boolean).join(" ");
}

export function capacityRiskCopy(
  risk: "unknown" | "at-risk" | "within-capacity",
): string {
  switch (risk) {
    case "unknown":
      return "Not enough information to compare work with capacity.";
    case "at-risk":
      return "Remaining work exceeds capacity.";
    case "within-capacity":
      return "Remaining work fits within capacity.";
  }
}
