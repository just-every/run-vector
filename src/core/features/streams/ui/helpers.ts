import type { StreamItem } from "./data";

export type StreamFilters = {
  teamId: string;
  assigneeId: string;
  priority: string;
};

const labels: Record<string, string> = {
  "awaiting-decision": "Awaiting decision",
  overdue: "Overdue",
  "started-work": "Started work",
  "due-within-seven-days": "Due within 7 days",
  "cycle-commitment": "Cycle commitment",
  "assigned-to-you": "Assigned to you",
  "completed-within-seven-days": "Completed this week",
  "customer-escalation": "Customer escalation",
  "unresolved-dependency": "Unresolved dependency",
  "unassigned-urgent-work": "Unassigned urgent work",
  "project-risk": "Project risk",
  "new-evidence": "New evidence",
};

export function reasonLabel(reason: string) {
  return labels[reason] ?? reason.replaceAll("-", " ");
}

export function filterItems(items: StreamItem[], filters: StreamFilters) {
  return items.filter(
    (item) =>
      (filters.teamId === "all" || item.team.id === filters.teamId) &&
      (filters.assigneeId === "all" ||
        (filters.assigneeId === "unassigned"
          ? item.assignee === null
          : item.assignee?.id === filters.assigneeId)) &&
      (filters.priority === "all" || item.priority === filters.priority),
  );
}

export function moveRowFocus(
  currentIndex: number,
  direction: "next" | "previous",
  count: number,
) {
  if (count === 0) return -1;
  if (direction === "next") return Math.min(count - 1, currentIndex + 1);
  return Math.max(0, currentIndex - 1);
}

export function shortDate(value: string | null) {
  if (value === null) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function relativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
