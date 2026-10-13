import assert from "node:assert/strict";
const quote = (value) =>
  value === null ? "NULL" : "'" + String(value).replaceAll("'", "''") + "'";

// Real D1 records with deliberately interleaved grouping and selected sort keys.
export async function createPagingFixture(context, fixture) {
  if (fixture.paging) return fixture.paging;
  const { opts } = fixture;
  const categories = [
    "backlog",
    "started",
    "intake",
    "unstarted",
    "completed",
    "canceled",
    "duplicate",
  ];
  const priorities = ["urgent", "high", "medium", "low", "none"];
  const rows = Array.from({ length: 315 }, (_, i) => {
    const team = opts.teams[i % 2];
    const status = opts.statuses.find(
      (s) => s.teamId === team.id && s.category === categories[i % 7],
    );
    assert.ok(status, "VIEW-001 paging fixture has each workflow category");
    const cycle =
      i % 3 === 0 ? opts.cycles.find((c) => c.teamId === team.id) : null;
    return {
      id: `01J9${String(i + 1).padStart(22, "0")}`,
      identifier: `PGP-${i + 1}`,
      team: team.id,
      status: status.id,
      category: status.category,
      priority: priorities[i % 5],
      assignee: i % 3 ? null : opts.operators[0].id,
      project: i % 2 ? null : opts.projects[0].id,
      cycle: cycle?.id ?? null,
      due: i % 3 ? `2026-10-0${1 + (i % 7)}` : null,
      created: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00Z`,
      updated: `2026-10-${String(1 + (i % 7)).padStart(2, "0")}T00:00:00Z`,
    };
  });
  await context.runtime.writeFixture(
    rows
      .map(
        (r, i) =>
          `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,assignee_operator_id,project_id,cycle_id,due_date,created_at,updated_at) VALUES(${[r.id, r.identifier, "PGP", i + 1, r.team, `Paging browser ${i}`, r.status, r.priority, r.assignee, r.project, r.cycle, r.due, r.created, r.updated].map(quote).join(",")});`,
      ),
  );
  fixture.paging = rows;
  return rows;
}

export function assertNoPageOverflow(audit) {
  assert.ok(
    audit.geometry.documentWidth <= audit.geometry.viewportWidth,
    "VIEW-001 VIEW-005 page fits viewport",
  );
}
