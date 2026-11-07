import { ApiError } from "../../../app/api-client";
import type { DependencyActivity } from "../activity";

export type Direction = DependencyActivity["direction"];

export const relationLabel = (direction: Direction) => direction === "blocked-by" ? "Blocked by" : "Blocking";

/** A refusal names neither an unavailable endpoint nor a hidden intermediate project. */
export function dependencyFailure(cause: unknown) {
  if (!(cause instanceof ApiError)) return "The dependency could not be saved. Try again.";
  const body = cause.body;
  const code = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "";
  if (code === "project_dependency_cycle") return "This dependency would create a cycle, so nothing changed.";
  if (cause.status === 404) return "That project is unavailable. Reload this project to review its dependencies.";
  return cause.message;
}

export function dependencyReceipt(added: boolean, direction: Direction, project: string, other: string) {
  if (direction === "blocked-by") return added ? `${project} is now blocked by ${other}.` : `${project} is no longer blocked by ${other}.`;
  return added ? `${project} now blocks ${other}.` : `${project} no longer blocks ${other}.`;
}

export function dependencyActivityText(kind: string, dependency: DependencyActivity) {
  return {
    title: kind === "project.dependency_added" ? "Dependency added" : "Dependency removed",
    detail: `${relationLabel(dependency.direction)} ${dependency.project?.name ?? "a deleted project"}`,
  };
}
