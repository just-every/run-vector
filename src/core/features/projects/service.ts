import type { WorkspaceSnapshot } from "../streams";
import { calculateHealth } from "./health";
import { categoryByStatus, isTerminalCategory } from "./facts";
export {
  categoryByStatus,
  dateInTimezone,
  isActiveCycle,
  isBlocked,
} from "./facts";

export type ProjectHealth =
  "blocked" | "at-risk" | "on-track" | "unknown" | "none";

export type ProjectRisk = {
  kind:
    "unresolved-dependency" | "unassigned-urgent" | "target-date" | "capacity";
  issueIdentifiers?: string[];
  message: string;
  dependencyLinks?: Array<{
    blockedIdentifier: string;
    blockingIdentifier: string;
  }>;
  capacity?: {
    cycleId: string;
    estimatedPoints: number;
    capacityPoints: number;
    unestimatedIssueCount: number;
  };
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  lifecycle: string;
  archived: boolean;
  startDate: string | null;
  targetDate: string | null;
  priority: string;
  color: string | null;
  icon: string | null;
  labels: Array<{id:string;name:string;color:string}>;
  teamIds: string[];
  lead: { id: string; name: string };
  health: ProjectHealth;
  healthExplanation: string | null;
  progress: { completed: number; total: number; percentage: number | null };
  risks: ProjectRisk[];
};

export type ProjectIssue = {
  id: string;
  identifier: string;
  title: string;
  status: { id: string; name: string; category: string };
  priority: string;
  assignee: { id: string; name: string } | null;
  team: { id: string; name: string };
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    capacity: number | null;
  } | null;
  estimate: number | null;
  dueDate: string | null;
  blockedBy: Array<{
    identifier: string;
    title: string;
    status: { name: string; category: string };
    unresolved: boolean;
  }>;
};

export type ProjectDetail = ProjectSummary & {
  teams: Array<{ id: string; name: string }>;
  cycles: Array<{
    id: string;
    name: string;
    team: { id: string; name: string };
    startsAt: string;
    endsAt: string;
    capacity: number | null;
    issueCount: number;
    remainingEstimatedPoints: number;
    unestimatedIssueCount: number;
  }>;
  dependencies: Array<{
    blockedIssue: {
      identifier: string;
      title: string;
      status: { name: string; category: string };
    };
    blockingIssue: {
      identifier: string;
      title: string;
      status: { name: string; category: string };
    };
    unresolved: boolean;
  }>;
  issues: ProjectIssue[];
};

export function listProjectSummaries(
  snapshot: WorkspaceSnapshot,
  now: Date,
  includeArchived = false,
): ProjectSummary[] {
  return snapshot.projects
    .filter((project) => includeArchived || project.archivedAt === null)
    .map((project) => buildProjectSummary(snapshot, project.id, now))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getProjectSummary(
  snapshot: WorkspaceSnapshot,
  projectId: string,
  now: Date,
): ProjectSummary | null {
  if (!snapshot.projects.some((project) => project.id === projectId)) {
    return null;
  }
  return buildProjectSummary(snapshot, projectId, now);
}

export function getProjectDetail(
  snapshot: WorkspaceSnapshot,
  projectId: string,
  now: Date,
): ProjectDetail | null {
  const summary = getProjectSummary(snapshot, projectId, now);
  if (!summary) return null;

  const categories = categoryByStatus(snapshot);
  const projectIssues = snapshot.issues.filter(
    (issue) => issue.projectId === projectId,
  );
  const issueById = new Map(snapshot.issues.map((issue) => [issue.id, issue]));
  const issueDetail = (issue: WorkspaceSnapshot["issues"][number]) =>
    projectIssue(snapshot, issue, categories, issueById);
  const projectIssueIds = new Set(projectIssues.map((issue) => issue.id));
  const teams = uniqueById(
    projectIssues.map((issue) =>
      requiredTeam(snapshot, issue.teamId, issue.identifier),
    ),
  )
    .map((team) => ({ id: team.id, name: team.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const cycles = cycleFacts(snapshot, projectIssues, categories);
  const dependencies = snapshot.dependencies
    .filter(
      (dependency) =>
        projectIssueIds.has(dependency.blockedIssueId) ||
        projectIssueIds.has(dependency.blockingIssueId),
    )
    .map((dependency) => {
      const blockedIssue = requiredIssue(issueById, dependency.blockedIssueId);
      const blockingIssue = requiredIssue(
        issueById,
        dependency.blockingIssueId,
      );
      return {
        blockedIssue: issueReference(snapshot, blockedIssue, categories),
        blockingIssue: issueReference(snapshot, blockingIssue, categories),
        unresolved: !isTerminalCategory(categories.get(blockingIssue.statusId)),
      };
    })
    .sort(
      (left, right) =>
        left.blockedIssue.identifier.localeCompare(
          right.blockedIssue.identifier,
        ) ||
        left.blockingIssue.identifier.localeCompare(
          right.blockingIssue.identifier,
        ),
    );

  return {
    ...summary,
    teams,
    cycles,
    dependencies,
    // Progress counts every issue; the list leaves archived issues out (AUTO-003).
    issues: projectIssues
      .filter((issue) => !issue.archivedAt)
      .map(issueDetail)
      .sort((left, right) => left.identifier.localeCompare(right.identifier)),
  };
}

export function projectHealthForIssue(
  snapshot: WorkspaceSnapshot,
  issueProjectId: string | null,
  now: Date,
): ProjectHealth {
  if (!issueProjectId) {
    return "none";
  }
  return getProjectSummary(snapshot, issueProjectId, now)?.health ?? "none";
}

function buildProjectSummary(
  snapshot: WorkspaceSnapshot,
  projectId: string,
  now: Date,
): ProjectSummary {
  const project = snapshot.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error(
      `Project ${projectId} is missing from the workspace snapshot`,
    );
  }
  const lead = snapshot.operators.find(
    (operator) => operator.id === project.leadOperatorId,
  );
  if (!lead) {
    throw new Error(`Project ${project.name} has no known lead`);
  }
  const projectIssues = snapshot.issues.filter(
    (issue) => issue.projectId === project.id,
  );
  const categories = categoryByStatus(snapshot);
  const completed = projectIssues.filter(
    (issue) => categories.get(issue.statusId) === "completed",
  );
  const countable = projectIssues.filter(
    (issue) =>
      !["canceled", "duplicate"].includes(categories.get(issue.statusId) ?? ""),
  );
  const health = calculateHealth(
    snapshot,
    project,
    projectIssues,
    now,
    categories,
  );

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    lifecycle: project.lifecycle,
    archived: project.archivedAt !== null,
    teamIds: [...new Set(projectIssues.map(issue=>issue.teamId))],
    startDate: project.startDate,
    targetDate: project.targetDate,
    priority: project.priority,
    color: project.color,
    icon: project.icon,
    labels: snapshot.projectLabels.filter(link=>link.projectId===project.id).map(link=>{
      const label=snapshot.labels.find(label=>label.id===link.labelId);
      if(!label)throw new Error(`Project ${project.id} has an unknown label`);
      return {id:label.id,name:label.name,color:label.color};
    }).sort((a,b)=>a.name.localeCompare(b.name)),
    lead: { id: lead.id, name: lead.name },
    health: health.value,
    healthExplanation: health.explanation,
    progress: {
      completed: completed.length,
      total: countable.length,
      percentage:
        countable.length === 0
          ? null
          : Math.round((completed.length / countable.length) * 100),
    },
    risks: health.risks,
  };
}

function projectIssue(
  snapshot: WorkspaceSnapshot,
  issue: WorkspaceSnapshot["issues"][number],
  categories: Map<string, string>,
  issueById: Map<string, WorkspaceSnapshot["issues"][number]>,
): ProjectIssue {
  const status = snapshot.statuses.find((item) => item.id === issue.statusId);
  if (!status)
    throw new Error(`Issue ${issue.identifier} has no workflow status`);
  const team = requiredTeam(snapshot, issue.teamId, issue.identifier);
  const assignee =
    issue.assigneeOperatorId === null
      ? null
      : snapshot.operators.find(
          (operator) => operator.id === issue.assigneeOperatorId,
        );
  if (issue.assigneeOperatorId !== null && !assignee)
    throw new Error(`Issue ${issue.identifier} has an unknown assignee`);
  const cycle =
    issue.cycleId === null
      ? null
      : snapshot.cycles.find((item) => item.id === issue.cycleId);
  if (issue.cycleId !== null && !cycle)
    throw new Error(`Issue ${issue.identifier} has an unknown cycle`);
  const blockedBy = snapshot.dependencies
    .filter((dependency) => dependency.blockedIssueId === issue.id)
    .map((dependency) =>
      issueReference(
        snapshot,
        requiredIssue(issueById, dependency.blockingIssueId),
        categories,
      ),
    )
    .map((dependency) => ({
      ...dependency,
      unresolved: !isTerminalCategory(dependency.status.category),
    }))
    .sort((left, right) => left.identifier.localeCompare(right.identifier));

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    status: { id: status.id, name: status.name, category: status.category },
    priority: issue.priority,
    assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    team: { id: team.id, name: team.name },
    cycle: cycle
      ? {
          id: cycle.id,
          name: cycle.name,
          startsAt: cycle.startsAt,
          endsAt: cycle.endsAt,
          capacity: cycle.capacity,
        }
      : null,
    estimate: issue.estimate,
    dueDate: issue.dueDate,
    blockedBy,
  };
}

function cycleFacts(
  snapshot: WorkspaceSnapshot,
  projectIssues: WorkspaceSnapshot["issues"],
  categories: Map<string, string>,
): ProjectDetail["cycles"] {
  const byCycle = new Map<string, WorkspaceSnapshot["issues"]>();
  for (const issue of projectIssues) {
    if (!issue.cycleId) continue;
    byCycle.set(issue.cycleId, [...(byCycle.get(issue.cycleId) ?? []), issue]);
  }
  return [...byCycle.entries()]
    .map(([cycleId, issues]) => {
      const cycle = snapshot.cycles.find((item) => item.id === cycleId);
      if (!cycle)
        throw new Error(`Project issue references unknown cycle ${cycleId}`);
      const team = requiredTeam(snapshot, cycle.teamId, cycle.name);
      const remaining = issues.filter(
        (issue) => !isTerminalCategory(categories.get(issue.statusId)),
      );
      return {
        id: cycle.id,
        name: cycle.name,
        team: { id: team.id, name: team.name },
        startsAt: cycle.startsAt,
        endsAt: cycle.endsAt,
        capacity: cycle.capacity,
        issueCount: issues.length,
        remainingEstimatedPoints: remaining.reduce(
          (total, issue) => total + (issue.estimate ?? 0),
          0,
        ),
        unestimatedIssueCount: remaining.filter(
          (issue) => issue.estimate === null,
        ).length,
      };
    })
    .sort(
      (left, right) =>
        left.startsAt.localeCompare(right.startsAt) ||
        left.name.localeCompare(right.name),
    );
}

function issueReference(
  snapshot: WorkspaceSnapshot,
  issue: WorkspaceSnapshot["issues"][number],
  categories: Map<string, string>,
) {
  const status = snapshot.statuses.find((item) => item.id === issue.statusId);
  if (!status)
    throw new Error(`Issue ${issue.identifier} has no workflow status`);
  return {
    identifier: issue.identifier,
    title: issue.title,
    status: {
      name: status.name,
      category: categories.get(status.id) ?? status.category,
    },
  };
}

function requiredIssue(
  issueById: Map<string, WorkspaceSnapshot["issues"][number]>,
  issueId: string,
) {
  const issue = issueById.get(issueId);
  if (!issue) throw new Error(`Dependency references unknown issue ${issueId}`);
  return issue;
}

function requiredTeam(
  snapshot: WorkspaceSnapshot,
  teamId: string,
  reference: string,
) {
  const team = snapshot.teams.find((item) => item.id === teamId);
  if (!team) throw new Error(`${reference} has an unknown team`);
  return team;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
