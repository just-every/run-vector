import { expect } from "vitest";
import { env } from "cloudflare:workers";
import { setupAdministration } from "./administration-fixture";
import type { ProjectDetail, ProjectSummary } from "../../src/core/features/projects/service";
import { issueDetailSchema } from "../../src/core/features/issues/ui/data";
import { createServerApp } from "../../src/core/app/server";
import { createUlid } from "../../src/core/shared/ids";
import { bindings, request } from "./base-auth-fixture";

export const at = "2030-06-04T12:00:00.000Z";
export const future = "2030-06-20";
export const past = "2030-06-03";

export async function projectRulesFixture() {
  const f = await setupAdministration();
  const team = f.initial.teams[0];
  const status = (category: string) => team.statuses.find((s) => s.category === category)!.id;
  async function json<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await f.call(path, method, body);
    expect(response.status, await response.clone().text()).toBe(200);
    return await response.json() as T;
  }
  const portfolio = (archived = false) => json<{
    projects: ProjectSummary[]; counts: Record<string, number>;
  }>(`/projects?at=${at}&includeArchived=${archived}`);
  const detail = (id: string) => json<ProjectDetail>(`/projects/${id}?at=${at}`);
  const issue = async (identifier: string) => issueDetailSchema.parse(await json(`/issues/${identifier}`));
  async function patch(identifier: string, body: Record<string, unknown>) {
    const current = await issue(identifier);
    return json(`/issues/${identifier}`, "PATCH", { expectedVersion: current.version, ...body });
  }
  async function project(name: string, targetDate: string | null = future, lifecycle = "active") {
    const state = await f.mutate("/settings/projects", "POST", { name, leadOperatorId: f.owner, targetDate });
    const created = state.projects.find((p) => p.name === name)!;
    if (lifecycle !== "planned") await f.mutate(`/settings/projects/${created.id}`, "PATCH", { lifecycle });
    return created;
  }
  async function cycle(name: string, capacity: number | null, teamId = team.id) {
    const state = await f.mutate("/settings/cycles", "POST", {
      name, teamId, capacity, startsLocal: "2030-06-01T00:00", endsLocal: "2030-06-15T00:00",
    });
    return state.cycles.find((c) => c.name === name)!;
  }
  async function block(blocked: string, blocker: string) {
    const [source, related] = await Promise.all([issue(blocked), issue(blocker)]);
    await json(`/issues/${blocked}/dependencies`, "POST", {
      expectedVersion: source.version, relatedVersion: related.version,
      relatedIdentifier: blocker, direction: "blocked-by",
    });
  }
  async function create(extra: Record<string, unknown> = {}) {
    const { statusId, ...fields } = extra;
    if (statusId === status("intake")) {
      const response = await f.call("/intake", "POST", {
        title: fields.title ?? "Intake project member", teamId: fields.teamId ?? team.id,
      });
      expect(response.status, await response.clone().text()).toBe(201);
      const created = await response.json() as Awaited<ReturnType<typeof f.create>>;
      const { teamId: _teamId, title: _title, ...properties } = fields;
      if (Object.keys(properties).length) await patch(created.identifier, properties);
      return created;
    }
    if (statusId === status("duplicate")) {
      const canonical = await f.create({ title: "Independent canonical issue" });
      const created = await f.create(fields);
      await json(`/issues/${created.identifier}/duplicate`, "POST", {
        expectedVersion: created.version, canonicalIdentifier: canonical.identifier,
      });
      return created;
    }
    if (fields.cycleId && [status("completed"), status("canceled")].includes(statusId as string)) {
      const created = await f.create({ ...fields, statusId: status("unstarted") });
      await patch(created.identifier, { statusId });
      return created;
    }
    return f.create(extra);
  }
  async function deniedDeletion(projectId: string) {
    const path = `/api/settings/projects/${projectId}`;
    expect((await request(path, "DELETE")).status).toBe(401);
    const crossOrigin = await createServerApp().request(bindings.APP_ORIGIN + path, {
      method: "DELETE", headers: { host: new URL(bindings.APP_ORIGIN).host, origin: "https://foreign.test", cookie: f.cookie },
    }, bindings);
    expect(crossOrigin.status).toBe(403);
    const workspace = createUlid(new Date()), owner = createUlid(new Date()), foreign = createUlid(new Date());
    const now = new Date().toISOString();
    // A second tenant is synthetic fixture state; the attempted deletion uses native authority.
    await env.DB.batch([
      env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Foreign','UTC',?,?)").bind(workspace, now, now),
      env.DB.prepare("INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,'Foreign owner','foreign-project-owner@example.test',?,?)").bind(owner, workspace, now, now),
      env.DB.prepare("INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,?,'Foreign project',?,'planned',?,?)").bind(foreign, workspace, owner, now, now),
    ]);
    try {
      // Vector refuses unsupported multi-workspace state at bootstrap, before any mutation.
      expect((await f.call(`/settings/projects/${foreign}`, "DELETE")).status).toBe(503);
      expect(await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(foreign).first()).toEqual({ id: foreign });
    } finally {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM projects WHERE id=?").bind(foreign),
        env.DB.prepare("DELETE FROM operators WHERE id=?").bind(owner),
        env.DB.prepare("DELETE FROM workspace_settings WHERE id=?").bind(workspace),
      ]);
    }
  }
  return { ...f, create, json, portfolio, detail, issue, patch, project, cycle, block, status, deniedDeletion };
}
