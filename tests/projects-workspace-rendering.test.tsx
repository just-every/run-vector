import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsWorkspace } from "../src/core/features/projects/ui/projects-workspace";
import { ProjectList } from "../src/core/features/projects/ui/project-list";
import {
  defaultPortfolioFilters,
  filterProjects,
} from "../src/core/features/projects/ui/helpers";
import type {
  ProjectPortfolioData,
  ProjectSummaryData,
} from "../src/core/features/projects/ui/data";
import type { Administration } from "../src/core/features/administration/schema";

const resources = vi.hoisted(() => ({
  portfolio: null as ProjectPortfolioData | null,
  administration: null as Administration | null,
  administrationLoading: false,
  administrationError: null as Error | null,
}));

vi.mock("../src/core/app/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/core/app/api-client")>()),
  useApiResource: (url: string) =>
    url.startsWith("/api/projects")
      ? {
          data: resources.portfolio,
          error: null,
          loading: false,
          reload: () => {},
        }
      : {
          data: resources.administration,
          error: resources.administrationError,
          loading: resources.administrationLoading,
          reload: () => {},
        },
}));

beforeEach(() => {
  resources.portfolio = {
    generatedAt: "2026-10-08T00:00:00.000Z",
    counts: {},
    projects: [],
  };
  resources.administration = {
    workspace: { id: "workspace-1", name: "Workspace", timezone: "UTC" },
    labelsPerIssue: 20,
    teams: [],
    labels: [],
    projects: [],
    operators: [{ id: "operator-1", name: "Delivery lead" }],
    cycles: [],
  };
  resources.administrationLoading = false;
  resources.administrationError = null;
});

describe("empty project portfolio", () => {
  it("[PROJ-007] invites the first project before creation is opened", () => {
    const html = renderToStaticMarkup(<ProjectsWorkspace />);

    expect(html).toContain("<h2>Create your first project</h2>");
    expect(html).toContain("Choose New project to start planning your work.");
    expect(html).not.toContain("No projects match these filters.");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">New project</button>");
    expect(html).not.toContain('<form aria-label="Create project"');
    expect(html).not.toContain('id="project-create-panel"');
    expect(html).not.toContain("Project name");
  });

  it("[PROJ-007 PROJ-009] does not invite a first project when only archived projects exist", () => {
    resources.administration!.projects.push({
      id: "archived-project-1",
      name: "Archived delivery plan",
      description: "Retained work",
      leadOperatorId: "operator-1",
      targetDate: null,
      lifecycle: "completed",
      archivedAt: "2026-10-07T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(<ProjectsWorkspace />);

    expect(html).toContain("No projects match these filters.");
    expect(html).not.toContain("Create your first project");
    expect(html).toContain("Include archived projects");
    expect(html).toContain('<input type="checkbox"/>');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="project-create-panel"');
    expect(html).not.toContain("Archived delivery plan");
  });

  it("[PROJ-007] waits for workspace project existence before declaring an empty portfolio", () => {
    resources.administration = null;
    resources.administrationLoading = true;
    const html = renderToStaticMarkup(<ProjectsWorkspace />);

    expect(html).toContain("Loading Projects…");
    expect(html).not.toContain("Create your first project");
    expect(html).not.toContain("No projects match these filters.");
    expect(html).not.toContain('id="project-create-panel"');
  });

  it.each([false, true])(
    "[PROJ-007] shows an actionable project-information error without claiming emptiness (retained data: %s)",
    (retainedData) => {
      if (!retainedData) resources.administration = null;
      resources.administrationError = new Error("Project information unavailable");
      const html = renderToStaticMarkup(<ProjectsWorkspace />);

      expect(html).toContain('role="alert"');
      expect(html).toContain("Unable to load project information.");
      expect(html).toContain("Project information unavailable");
      expect(html).toContain(">Retry administration</button>");
      expect(html).not.toContain("Create your first project");
      expect(html).not.toContain("No projects match these filters.");
      expect(html).not.toContain('id="project-create-panel"');
    },
  );

  it("[PROJ-007] keeps the first-project invitation when filters remain selected on an empty portfolio", () => {
    const html = renderToStaticMarkup(
      <ProjectList
        projects={[]}
        hasProjects={false}
        filters={{ lifecycle: "active", health: "blocked" }}
        lifecycleOptions={[]}
        onFiltersChange={() => {}}
      />,
    );

    expect(html).toContain("<h2>Create your first project</h2>");
    expect(html).not.toContain("No projects match these filters.");
  });

  it("[PROJ-007] describes a filtered result with no matches when projects already exist", () => {
    const project: ProjectSummaryData = {
      id: "project-1",
      name: "Delivery plan",
      description: "Plan the work",
      lifecycle: "active",
      archived: false,
      targetDate: null,
      lead: { id: "operator-1", name: "Delivery lead" },
      health: "on-track",
      progress: { completed: 0, total: 0, percentage: null },
      risks: [],
    };
    const rawProjects = [project];
    const filters = { ...defaultPortfolioFilters, lifecycle: "completed" };
    const html = renderToStaticMarkup(
      <ProjectList
        projects={filterProjects(rawProjects, filters)}
        hasProjects={rawProjects.length > 0}
        filters={filters}
        lifecycleOptions={["active"]}
        onFiltersChange={() => {}}
      />,
    );

    expect(html).toContain("No projects match these filters.");
    expect(html).not.toContain("Create your first project");
    expect(html).not.toContain("Delivery plan");
  });
});
