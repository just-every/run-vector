import type { WorkspaceSnapshot } from "../streams";
import type { ProjectHealth, ProjectRisk } from "./service";
import { dateInTimezone, isActiveCycle, isBlocked } from "./facts";

export function calculateHealth(
  snapshot: WorkspaceSnapshot,
  project: WorkspaceSnapshot["projects"][number],
  projectIssues: WorkspaceSnapshot["issues"],
  now: Date,
  categories: Map<string, string>,
): { value: ProjectHealth; risks: ProjectRisk[]; explanation: string | null } {
  if (project.lifecycle !== "active") {
    return { value: "none", risks: [], explanation: null };
  }

  const remaining = projectIssues.filter(
    (issue) =>
      !["completed", "canceled", "duplicate"].includes(
        categories.get(issue.statusId) ?? "",
      ),
  );
  const unresolvedBlocked = remaining.filter((issue) =>
    isBlocked(snapshot, issue.id, categories),
  );
  const urgentBlocked = remaining.filter(
    (issue) =>
      issue.priority === "urgent" && isBlocked(snapshot, issue.id, categories),
  );
  const isProjectBlocked =
    remaining.length > 0 &&
    (urgentBlocked.length > 0 || unresolvedBlocked.length === remaining.length);
  const triggering =
    urgentBlocked.length > 0 ? urgentBlocked : unresolvedBlocked;
  const triggeringIds = new Set(triggering.map((issue) => issue.id));
  const dependencyLinks = snapshot.dependencies
    .filter((dependency) => {
      if (!isProjectBlocked || !triggeringIds.has(dependency.blockedIssueId))
        return false;
      const blocker = snapshot.issues.find(
        (issue) => issue.id === dependency.blockingIssueId,
      );
      if (!blocker)
        throw new Error(
          `Dependency references missing issue ${dependency.blockingIssueId}`,
        );
      return !["completed", "canceled", "duplicate"].includes(
        categories.get(blocker.statusId) ?? "",
      );
    })
    .map((dependency) => {
      const blocked = snapshot.issues.find(
        (issue) => issue.id === dependency.blockedIssueId,
      )!;
      const blocker = snapshot.issues.find(
        (issue) => issue.id === dependency.blockingIssueId,
      )!;
      return {
        blockedIdentifier: blocked.identifier,
        blockingIdentifier: blocker.identifier,
      };
    })
    .sort(
      (a, b) =>
        a.blockedIdentifier.localeCompare(b.blockedIdentifier) ||
        a.blockingIdentifier.localeCompare(b.blockingIdentifier),
    );
  const blockedRisks: ProjectRisk[] = isProjectBlocked
    ? [
        {
          kind: "unresolved-dependency",
          issueIdentifiers: triggering.map((issue) => issue.identifier),
          dependencyLinks,
          message:
            urgentBlocked.length > 0
              ? `Urgent work is blocked: ${urgentBlocked.map((issue) => issue.identifier).join(", ")}`
              : "Every remaining issue is blocked by an unresolved dependency.",
        },
      ]
    : [];

  const today = dateInTimezone(now, snapshot.workspace?.timezone ?? "UTC");
  const atRisk: ProjectRisk[] = [];
  if (project.targetDate !== null && project.targetDate < today) {
    atRisk.push({
      kind: "target-date",
      issueIdentifiers: remaining.map((issue) => issue.identifier),
      message: `Target date ${project.targetDate} has passed.`,
    });
  }
  const unassignedUrgent = remaining.filter(
    (issue) => issue.priority === "urgent" && issue.assigneeOperatorId === null,
  );
  if (unassignedUrgent.length > 0) {
    atRisk.push({
      kind: "unassigned-urgent",
      issueIdentifiers: unassignedUrgent.map((issue) => issue.identifier),
      message: `Urgent work is unassigned: ${unassignedUrgent.map((issue) => issue.identifier).join(", ")}`,
    });
  }
  const capacityRisks = capacityRisk(snapshot, remaining, now);
  atRisk.push(...capacityRisks);
  if (isProjectBlocked) {
    return {
      value: "blocked",
      risks: [...blockedRisks, ...atRisk],
      explanation:
        urgentBlocked.length > 0
          ? "Urgent remaining work has an unresolved dependency."
          : "Every remaining issue has an unresolved dependency.",
    };
  }
  if (atRisk.length > 0) {
    return {
      value: "at-risk",
      risks: atRisk,
      explanation:
        "The remaining work has date, ownership or capacity exposure.",
    };
  }

  const activeCycleIssues = remaining.filter(
    (issue) =>
      issue.cycleId !== null && isActiveCycle(snapshot, issue.cycleId, now),
  );
  const allApplicableEstimated = activeCycleIssues.every(
    (issue) => issue.estimate !== null,
  );
  const allApplicableCapacityKnown = activeCycleIssues.every((issue) => {
    const cycle = snapshot.cycles.find((item) => item.id === issue.cycleId);
    return cycle?.capacity !== null && cycle?.capacity !== undefined;
  });
  if (
    project.targetDate !== null &&
    project.targetDate > today &&
    allApplicableEstimated &&
    allApplicableCapacityKnown
  ) {
    return {
      value: "on-track",
      risks: [],
      explanation:
        "The target date is in the future and all remaining active-cycle estimates and capacities are known and within capacity.",
    };
  }
  const missing: string[] = [];
  if (project.targetDate === null) missing.push("a target date");
  else if (project.targetDate === today)
    missing.push("a target date beyond today");
  if (!allApplicableEstimated)
    missing.push("estimates for remaining active-cycle work");
  if (!allApplicableCapacityKnown)
    missing.push("capacity for every active cycle with remaining work");
  return {
    value: "unknown",
    risks: [],
    explanation: `Health needs ${missing.join(", ")}.`,
  };
}

function capacityRisk(
  snapshot: WorkspaceSnapshot,
  remaining: WorkspaceSnapshot["issues"],
  now: Date,
): ProjectRisk[] {
  const byCycle = new Map<string, WorkspaceSnapshot["issues"]>();
  for (const issue of remaining) {
    if (issue.cycleId && isActiveCycle(snapshot, issue.cycleId, now)) {
      byCycle.set(issue.cycleId, [
        ...(byCycle.get(issue.cycleId) ?? []),
        issue,
      ]);
    }
  }
  return [...byCycle.entries()].flatMap(([cycleId, cycleIssues]) => {
    const cycle = snapshot.cycles.find((item) => item.id === cycleId);
    if (!cycle || cycle.capacity === null) {
      return [];
    }
    const points = cycleIssues.reduce(
      (total, issue) => total + (issue.estimate ?? 0),
      0,
    );
    if (points <= cycle.capacity) {
      return [];
    }
    const unestimated = cycleIssues.filter(
      (issue) => issue.estimate === null,
    ).length;
    return [
      {
        kind: "capacity" as const,
        capacity: {
          cycleId,
          estimatedPoints: points,
          capacityPoints: cycle.capacity,
          unestimatedIssueCount: unestimated,
        },
        issueIdentifiers: cycleIssues.map((issue) => issue.identifier),
        message:
          unestimated > 0
            ? `${cycle.name} has at least ${points} remaining estimated points and ${unestimated} unestimated issues against a capacity of ${cycle.capacity}.`
            : `${cycle.name} has ${points} remaining points against a capacity of ${cycle.capacity}.`,
      },
    ];
  });
}
