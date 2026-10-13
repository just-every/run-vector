import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { inject } from "vitest";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { createUlid } from "../../src/core/shared/ids";
export { ids };
export const categories = [
  "backlog",
  "started",
  "intake",
  "unstarted",
  "completed",
  "canceled",
  "duplicate",
];
export const priorities = ["urgent", "high", "medium", "low", "none"];
export async function browseFixture() {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date("2026-09-30T00:00:00Z"));
  const teams = (
    await env.DB.prepare(
      "SELECT id FROM teams WHERE workspace_id=? ORDER BY id LIMIT 2",
    )
      .bind(ids.workspace)
      .all<{ id: string }>()
  ).results;
  const statuses = (
    await env.DB.prepare(
      "SELECT id,team_id,category,position FROM workflow_statuses",
    ).all<{ id: string; team_id: string; category: string; position: number }>()
  ).results;
  const project = (await env.DB.prepare(
    "SELECT id FROM projects WHERE workspace_id=? LIMIT 1",
  )
    .bind(ids.workspace)
    .first<{ id: string }>())!.id;
  const cycle = (await env.DB.prepare(
    "SELECT id,team_id FROM cycles LIMIT 1",
  ).first<{ id: string; team_id: string }>())!;
  const label = createUlid(new Date()),
    issueIds = Array.from({ length: 77 }, () => createUlid(new Date()));
  await env.DB.prepare(
    "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES(?,?,?,'#336699','now','now')",
  )
    .bind(label, ids.workspace, "Browse label")
    .run();
  const rows = issueIds.map((id, i) => {
    const team = teams[i % 2].id,
      category = categories[i % 7],
      status = statuses.find(
        (s) => s.team_id === team && s.category === category,
      )!;
    return {
      id,
      identifier: `BRW-${i + 1}`,
      title: `Browse specimen ${String(i).padStart(3, "0")}`,
      team,
      category,
      status: status.id,
      position: status.position,
      priority: priorities[i % 5],
      assignee: i % 2 ? null : ids.sarah,
      project: i % 2 ? null : project,
      cycle: team === cycle.team_id && i % 3 === 0 ? cycle.id : null,
      due: i % 3 === 0 ? null : i % 3 === 1 ? "2026-10-02" : "2026-10-03",
      parent: i > 1 && i % 2 === 0 ? issueIds[0] : null,
      blocked: i !== 1 && i % 3 === 0,
      label: i % 2 === 0,
      created: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00Z`,
      updated: `2026-10-${String(1 + (i % 7)).padStart(2, "0")}T00:00:00Z`,
    };
  });
  await env.DB.batch(
    rows.map((r, i) =>
      env.DB.prepare(
        `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,assignee_operator_id,project_id,cycle_id,due_date,created_at,updated_at) VALUES(?,?,'BRW',?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        r.id,
        r.identifier,
        i + 1,
        r.team,
        r.title,
        r.status,
        r.priority,
        r.assignee,
        r.project,
        r.cycle,
        r.due,
        r.created,
        r.updated,
      ),
    ),
  );
  await env.DB.batch(
    rows
      .filter((r) => r.parent)
      .map((r) =>
        env.DB.prepare(
          "INSERT INTO issue_parents(issue_id,parent_issue_id,created_at) VALUES(?,?,'now')",
        ).bind(r.id, r.parent),
      ),
  );
  await env.DB.batch(
    rows
      .filter((r) => r.label)
      .map((r) =>
        env.DB.prepare("INSERT INTO issue_labels VALUES(?,?,'now')").bind(
          r.id,
          label,
        ),
      ),
  );
  await env.DB.batch(
    rows
      .filter((r) => r.blocked)
      .map((r) =>
        env.DB.prepare("INSERT INTO issue_dependencies VALUES(?,?,'now')").bind(
          r.id,
          issueIds[1],
        ),
      ),
  );
  return { rows, teams, project, cycle, label, statuses };
}
