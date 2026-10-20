import type { WorkspaceSnapshot } from "../streams";
import { categoryByStatus, dateInTimezone } from "./facts";

export type ProjectMilestone = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  position: number;
  completed: boolean;
  progress: { completed: number; total: number; percentage: number | null };
  slipped: boolean;
};

export function projectMilestones(
  snapshot: WorkspaceSnapshot,
  projectId: string,
  now: Date,
): ProjectMilestone[] {
  if (!snapshot.workspace) throw new Error("Workspace settings are missing");
  const today = dateInTimezone(now, snapshot.workspace.timezone);
  const categories = categoryByStatus(snapshot);
  return snapshot.projectMilestones
    .filter((milestone) => milestone.projectId === projectId)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map((milestone) => {
      const countable = snapshot.issues.filter((issue) =>
        issue.projectId === projectId && issue.milestoneId === milestone.id &&
        !["canceled", "duplicate"].includes(categories.get(issue.statusId) ?? ""),
      );
      const completed = countable.filter((issue) => categories.get(issue.statusId) === "completed").length;
      return {
        id: milestone.id,
        projectId: milestone.projectId,
        name: milestone.name,
        description: milestone.description,
        targetDate: milestone.targetDate,
        position: milestone.position,
        completed: milestone.completed,
        progress: {
          completed,
          total: countable.length,
          percentage: countable.length === 0 ? null : Math.round(completed / countable.length * 100),
        },
        slipped: milestone.targetDate !== null &&
          milestone.targetDate < today && countable.length > completed,
      };
    });
}
