import { z } from "zod";
import type { IssueDetailData } from "./data";
import type { StreamOptions } from "../../streams/ui/data";

// Only an explicitly recorded recommendation contributes choices. Core does
// not derive an assessment from measurements or source prose.
export const recommendationSchema = z.object({
  source: z.literal("policy"),
  assigneeOperatorId: z.string().nullable().optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  statusCategory: z.enum(["started", "unstarted"]).optional(),
  statusId: z.string().optional(),
  cycleId: z.string().nullable().optional(),
});

export function intakeRecommendation(
  issue: Pick<IssueDetailData, "evidence" | "team">,
  options: StreamOptions | null,
) {
  const ordered = [...issue.evidence].sort(
    (a, b) =>
      b.observedAt.localeCompare(a.observedAt) ||
      b.receivedAt.localeCompare(a.receivedAt),
  );
  const parsed = recommendationSchema.safeParse(
    ordered[0]?.assertions.recommendation,
  );
  const recorded = parsed.success ? parsed.data : undefined;
  // Signed producers use source-attributed primitive assertions. The policy
  // takes an explicit assignee claim as a suggestion, never as an assignment.
  const sourceAssignee = z.object({
    attribution: z.literal("source"),
    value: z.string().nullable(),
  }).safeParse(ordered[0]?.assertions.assigneeOperatorId);
  const requestedAssignee = recorded?.assigneeOperatorId !== undefined
    ? recorded.assigneeOperatorId
    : sourceAssignee.success ? sourceAssignee.data.value : undefined;
  const statuses =
    options?.statuses.filter((s) => s.teamId === issue.team.id) ?? [];
  const status = recorded?.statusId
    ? statuses.find(
        (s) =>
          s.id === recorded.statusId &&
          ["started", "unstarted"].includes(s.category),
      )
    : recorded?.statusCategory
      ? statuses
          .filter((s) => s.category === recorded.statusCategory)
          .sort((a, b) => a.position - b.position)[0]
      : undefined;
  const assignee =
    requestedAssignee &&
    options?.operators.some((o) => o.id === requestedAssignee)
      ? requestedAssignee
      : "";
  const cycle =
    recorded?.cycleId &&
    options?.cycles.some(
      (c) => c.id === recorded.cycleId && c.teamId === issue.team.id,
    )
      ? recorded.cycleId
      : "";
  return {
    assigneeOperatorId: assignee,
    priority: recorded?.priority ?? "none",
    statusId: status?.id ?? statuses.filter(s => s.category === "unstarted")
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))[0]?.id ?? "",
    cycleId: cycle,
    recommended: {
      assignee: requestedAssignee === null || Boolean(assignee),
      priority: recorded?.priority !== undefined,
      status: Boolean(status),
      cycle: recorded?.cycleId === null || Boolean(cycle),
    },
  };
}
