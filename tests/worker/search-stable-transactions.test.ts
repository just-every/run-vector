import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { searchFixture, searchNow } from "./search-fixture";

it("[SEARCH-003] a broken stable index aborts every dependent searchable source mutation", async () => {
  const f = await searchFixture(),
    project = await f.project("Transactional project"),
    view = await f.view("Transactional view");
  const issue = await f.issue("Transactional issue", { project });
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES('stable-comment',?,?,'Before comment',?,?)",
    ).bind(issue.id, f.actor.id, searchNow, searchNow),
    env.DB.prepare(
      "INSERT INTO evidence_revisions(id,issue_id,source_name,observed_at,received_at,summary,created_at,updated_at) VALUES('stable-evidence',?,'operator',?,?,'Before evidence',?,?)",
    ).bind(issue.id, searchNow, searchNow, searchNow, searchNow),
    env.DB.prepare(
      "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES('stable-label',?,'Before label','#abcdef',?,?)",
    ).bind(f.actor.workspace_id, searchNow, searchNow),
    env.DB.prepare("INSERT INTO issue_labels VALUES(?,'stable-label',?)").bind(
      issue.id,
      searchNow,
    ),
  ]);
  const source = async () =>
    Promise.all(
      [
        "issues",
        "issue_comments",
        "evidence_revisions",
        "labels",
        "issue_labels",
        "projects",
        "saved_views",
        "search_index_state",
      ].map(async (table) => ({
        table,
        rows: (
          await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()
        ).results,
      })),
    );
  const before = await source();
  await env.DB.prepare("DROP TABLE search_issues").run();
  for (const sql of [
    "UPDATE issues SET title='After issue'",
    "UPDATE issue_comments SET body='After comment' WHERE id='stable-comment'",
    "UPDATE issue_comments SET deleted_at='2026-10-02' WHERE id='stable-comment'",
    "DELETE FROM issue_comments WHERE id='stable-comment'",
    "UPDATE evidence_revisions SET summary='After evidence' WHERE id='stable-evidence'",
    "DELETE FROM evidence_revisions WHERE id='stable-evidence'",
    "UPDATE labels SET name='After label' WHERE id='stable-label'",
    "DELETE FROM labels WHERE id='stable-label'",
    "DELETE FROM issue_labels WHERE label_id='stable-label'",
    "UPDATE projects SET name='After project'",
  ]) {
    await expect(env.DB.prepare(sql).run(), sql).rejects.toThrow();
    expect(await source(), sql).toEqual(before);
  }
  await env.DB.prepare("DROP TABLE search_views").run();
  await expect(
    env.DB.prepare("UPDATE saved_views SET name='After view' WHERE id=?")
      .bind(view)
      .run(),
  ).rejects.toThrow();
  expect(await source()).toEqual(before);
});
