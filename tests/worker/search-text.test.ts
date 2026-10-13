import { env } from "cloudflare:workers";
import { beforeAll, expect, it, vi } from "vitest";
import * as streams from "../../src/core/features/streams";
import {
  getSearchOptions,
  searchWorkspace,
} from "../../src/core/features/search";
import {
  addComment,
  changeComment,
} from "../../src/core/features/discussion/repository";
import { searchFixture, searchId, searchNow } from "./search-fixture";
let f: Awaited<ReturnType<typeof searchFixture>>;
beforeAll(async () => {
  f = await searchFixture();
});
const find = (q: string) => searchWorkspace(env.DB, f.actor.id, q, false);

it("[SEARCH-001 SEARCH-003 ISSUE-008 ISSUE-010] every text source is immediately indexed and SQL edits and erasures remove obsolete text", async () => {
  const project = await f.project("Projectopal");
  const issue = await f.issue("Titleamber", {
    project,
    description: "Descriptionbasil",
    expected: "Outcomecrimson",
    impact: "Impactdahlia",
  });
  const comment = await addComment(
    env.DB,
    issue.id,
    f.actor.id,
    "Commentechinacea",
  );
  const evidence = searchId(),
    label = searchId();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO evidence_revisions(id,issue_id,source_name,observed_at,received_at,summary,created_at,updated_at) VALUES(?,?,'operator',?,?,?,?,?)",
    ).bind(
      evidence,
      issue.id,
      searchNow,
      searchNow,
      "Evidencefuchsia",
      searchNow,
      searchNow,
    ),
    env.DB.prepare(
      "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES(?,?,?,'#abcdef',?,?)",
    ).bind(label, f.actor.workspace_id, "Labelgardenia", searchNow, searchNow),
    env.DB.prepare("INSERT INTO issue_labels VALUES(?,?,?)").bind(
      issue.id,
      label,
      searchNow,
    ),
  ]);
  for (const token of [
    "Titleamber",
    "Descriptionbasil",
    "Outcomecrimson",
    "Impactdahlia",
    "Commentechinacea",
    "Evidencefuchsia",
    "Labelgardenia",
    "Projectopal",
  ])
    expect(
      (await find(token)).issues.map((i) => i.id),
      token,
    ).toContain(issue.id);
  expect((await find(issue.identifier.toLowerCase())).issues[0].id).toBe(
    issue.id,
  );
  await changeComment(env.DB, issue, comment, f.actor.id, "Commentheather");
  expect((await find("Commentechinacea")).issues).toEqual([]);
  expect((await find("Commentheather")).issues[0].id).toBe(issue.id);
  await changeComment(env.DB, issue, comment, f.actor.id, null);
  expect((await find("Commentheather")).issues).toEqual([]);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE issues SET title='Titleiris',description='Descriptionjasmine',expected_outcome='Outcomekelp',customer_impact='Impactlotus' WHERE id=?",
    ).bind(issue.id),
    env.DB.prepare(
      "UPDATE evidence_revisions SET summary='Evidencemagnolia' WHERE id=?",
    ).bind(evidence),
    env.DB.prepare("UPDATE labels SET name='Labelnectarine' WHERE id=?").bind(
      label,
    ),
    env.DB.prepare("UPDATE projects SET name='Projectorchid' WHERE id=?").bind(
      project,
    ),
  ]);
  for (const token of [
    "Titleamber",
    "Descriptionbasil",
    "Outcomecrimson",
    "Impactdahlia",
    "Evidencefuchsia",
    "Labelgardenia",
    "Projectopal",
  ])
    expect((await find(token)).issues, token).toEqual([]);
  for (const token of [
    "Titleiris",
    "Descriptionjasmine",
    "Outcomekelp",
    "Impactlotus",
    "Evidencemagnolia",
    "Labelnectarine",
    "Projectorchid",
  ])
    expect((await find(token)).issues[0].id, token).toBe(issue.id);
  expect((await find("Projectorchid")).projects[0].id).toBe(project);
  await env.DB.prepare("DELETE FROM issue_labels WHERE issue_id=?")
    .bind(issue.id)
    .run();
  expect((await find("Labelnectarine")).issues).toEqual([]);
  await env.DB.prepare("INSERT INTO issue_labels VALUES(?,?,?)")
    .bind(issue.id, label, searchNow)
    .run();
  expect((await find("Labelnectarine")).issues[0].id).toBe(issue.id);
  await env.DB.prepare("DELETE FROM labels WHERE id=?").bind(label).run();
  expect((await find("Labelnectarine")).issues).toEqual([]);
  await env.DB.prepare("DELETE FROM evidence_revisions WHERE id=?")
    .bind(evidence)
    .run();
  expect((await find("Evidencemagnolia")).issues).toEqual([]);
  await env.DB.prepare("UPDATE issues SET project_id=NULL WHERE id=?")
    .bind(issue.id)
    .run();
  expect((await find("Projectorchid")).issues).toEqual([]);
  await env.DB.prepare("DELETE FROM projects WHERE id=?").bind(project).run();
  expect((await find("Projectorchid")).projects).toEqual([]);
  await env.DB.prepare("DELETE FROM issue_comments WHERE issue_id=?")
    .bind(issue.id)
    .run();
  await env.DB.prepare("DELETE FROM issues WHERE id=?").bind(issue.id).run();
  expect((await find("Titleiris")).issues).toEqual([]);
});

it("[SEARCH-001 SEARCH-003] literal Unicode words, punctuation and FTS operators are safe", async () => {
  const issue = await f.issue("Café 日本語 résumé OR NEAR searchsyntax");
  for (const q of [
    "Café",
    "日本語",
    "résumé",
    "OR",
    "NEAR",
    '"searchsyntax"',
    "searchsyntax*",
    "(searchsyntax)",
    "searchsyntax:",
    "searchsyntax -",
  ])
    expect(
      (await find(q)).issues.map((i) => i.id),
      q,
    ).toContain(issue.id);
  for (const q of [
    "",
    '"',
    ":*()",
    "%_",
    "AND NOT nonsense",
    "'); DROP TABLE issues; --",
  ])
    await expect(find(q)).resolves.toEqual({
      issues: [],
      projects: [],
      savedViews: [],
    });
});

it("[SEARCH-001 OPS-001 VIEW-002] search and options never load the workspace snapshot", async () => {
  const snapshot = vi
    .spyOn(streams, "loadWorkspaceSnapshot")
    .mockRejectedValue(new Error("Snapshot prohibited"));
  try {
    expect((await find("searchsyntax")).issues.length).toBe(1);
    expect((await getSearchOptions(env.DB, f.actor.id)).workspace.id).toBe(
      f.actor.workspace_id,
    );
    expect(snapshot).not.toHaveBeenCalled();
  } finally {
    snapshot.mockRestore();
  }
});
