import { deleteRequest } from './issue-deletion-request';
import { env } from "cloudflare:workers";
import { beforeAll, it, expect } from "vitest";
import { contractWith } from "../contract-tags";
import { setup, create, call, ids, receipt } from "./parent-auth-fixture";
import {
  updateIssueParent,
} from "../../src/core/features/parents/repository";
import {
  sampleOwner,
  samplePeer,
  sampleSession,
  sampleBindings,
  origin,
} from "./sample-auth-fixture";
import { createApiApp } from "../../src/core/app/api";
import { beforeCommit } from "./removal-interleaving";
beforeAll(setup);
const parent = (issue: any, parentIdentifier: string | null, db = env.DB) =>
  call(
    `/issues/${issue.identifier}/parent`,
    { expectedVersion: issue.version, parentIdentifier },
    "PATCH",
    db,
  );
contractWith(
  it,
  "REL-006 ISSUE-006 ISSUE-007 OPS-001",
  "parents across teams preserve context, project direct children and clear independently",
  async () => {
    const a = await create({ teamId: ids.platform }),
      b = await create({
        assigneeOperatorId: ids.maya,
        projectId: ids.reliability,
        cycleId: ids.flowCycle,
      });
    const res = await parent(b, a.identifier);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as any;
    expect(detail.parent).toEqual({
      id: a.id,
      identifier: a.identifier,
      title: a.title,
      status: a.status,
    });
    expect(detail.version).toBe(b.version + 1);
    for (const field of ["status", "team", "project", "cycle", "assignee"])
      expect(detail[field]).toEqual(b[field]);
    expect(detail.activity.at(-1)).toMatchObject({
      kind: "issue.parent_changed",
      previousValue: { parentIdentifier: null },
      nextValue: { parentIdentifier: a.identifier },
    });
    const root = (await (await call(`/issues/${a.identifier}`)).json()) as any;
    expect(root.children).toEqual([
      { id: b.id, identifier: b.identifier, title: b.title, status: b.status },
    ]);
    const cleared = await parent(detail, null);
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ parent: null, version: 3 });
    expect(
      ((await (await call(`/issues/${a.identifier}`)).json()) as any).children,
    ).toEqual([]);
  },
);
contractWith(
  it,
  "REL-006 ISSUE-006",
  "self-parenting, ancestry cycles and stale edits leave all receipts untouched",
  async () => {
    const a = await create(),
      b = await create(),
      c = await create();
    expect((await parent(b, a.identifier)).status).toBe(200);
    expect((await parent(c, b.identifier)).status).toBe(200);
    const before = await receipt();
    expect((await parent(a, a.identifier)).status).toBe(400);
    expect((await parent(a, c.identifier)).status).toBe(400);
    const stale = await parent(b, null);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: "stale_version",
      version: 2,
      issue: { identifier: b.identifier, version: 2 },
    });
    expect(await receipt()).toEqual(before);
  },
);
contractWith(
  it,
  "REL-006 ISSUE-010 ISSUE-006 ISSUE-007",
  "public parent deletion makes only direct children roots and retains grandchildren",
  async () => {
    const a = await create(),
      b = await create(),
      c = await create();
    await updateIssueParent(env.DB, b.identifier, ids.sarah, {
      expectedVersion: 1,
      parentIdentifier: a.identifier,
    });
    await updateIssueParent(env.DB, c.identifier, ids.sarah, {
      expectedVersion: 1,
      parentIdentifier: b.identifier,
    });
    const beforeDelete = await receipt();
    expect(
      (await deleteRequest(a.identifier, 2)).status,
    ).toBe(409);
    expect(await receipt()).toEqual(beforeDelete);
    expect(
      (await deleteRequest(a.identifier, 1)).status,
    ).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
      )
        .bind(b.id)
        .first("parent_issue_id"),
    ).toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
      )
        .bind(c.id)
        .first("parent_issue_id"),
    ).toBe(b.id);
    const originalChild = beforeDelete.issues.find(
      (row: any) => row.id === b.id,
    ) as any;
    expect(
      await env.DB.prepare("SELECT * FROM issues WHERE id=?")
        .bind(b.id)
        .first(),
    ).toEqual({
      ...originalChild,
      version: originalChild.version + 1,
      updated_at: expect.any(String),
    });
    expect(
      await env.DB.prepare("SELECT * FROM issues WHERE id=?")
        .bind(c.id)
        .first(),
    ).toEqual(beforeDelete.issues.find((row: any) => row.id === c.id));
    expect(
      await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(b.id)
        .first("version"),
    ).toBe(3);
    expect(
      await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(c.id)
        .first("version"),
    ).toBe(2);
    const detach = await env.DB.prepare(
      "SELECT previous_value_json,next_value_json,actor_operator_id FROM issue_activity WHERE issue_id=? AND kind='issue.parent_changed' ORDER BY created_at DESC LIMIT 1",
    )
      .bind(b.id)
      .first<any>();
    expect(JSON.parse(detach.previous_value_json)).toEqual({
      parentIdentifier: a.identifier,
    });
    expect(JSON.parse(detach.next_value_json)).toEqual({
      parentIdentifier: null,
    });
    expect(detach.actor_operator_id).toBe(ids.sarah);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_activity WHERE issue_id=?",
      )
        .bind(a.id)
        .first("n"),
    ).toBe(0);
  },
);
contractWith(
  it,
  "REL-006",
  "database guards refuse concurrent opposing parents and direct SQL cycles",
  async () => {
    const a = await create(),
      b = await create();
    const outcomes = await Promise.allSettled([
      updateIssueParent(env.DB, a.identifier, ids.sarah, {
        expectedVersion: 1,
        parentIdentifier: b.identifier,
      }),
      updateIssueParent(env.DB, b.identifier, ids.sarah, {
        expectedVersion: 1,
        parentIdentifier: a.identifier,
      }),
    ]);
    expect(outcomes.filter((row) => row.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(outcomes.filter((row) => row.status === "rejected")).toHaveLength(1);
    const rows = (
      await env.DB.prepare(
        "SELECT i.id,link.parent_issue_id FROM issues i LEFT JOIN issue_parents link ON link.issue_id=i.id WHERE i.id IN (?,?)",
      )
        .bind(a.id, b.id)
        .all<any>()
    ).results;
    const root = rows.find((row) => row.parent_issue_id === null),
      child = rows.find((row) => row.parent_issue_id !== null);
    await expect(
      env.DB.prepare(
        "INSERT INTO issue_parents(parent_issue_id,issue_id,created_at) VALUES(?,?,'2026-10-08T00:00:00.000Z') ON CONFLICT(issue_id) DO UPDATE SET parent_issue_id=excluded.parent_issue_id",
      )
        .bind(child.id, root.id)
        .run(),
    ).rejects.toThrow(/issue_parent_cycle/);
  },
);
contractWith(
  it,
  "REL-006 OPS-001",
  "workspace guards reject foreign parents and hierarchy-breaking team movement at SQL boundary",
  async () => {
    const a = await create(),
      b = await create({ teamId: ids.platform });
    await updateIssueParent(env.DB, b.identifier, ids.sarah, {
      expectedVersion: 1,
      parentIdentifier: a.identifier,
    });
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES('foreign','Foreign','UTC',?,?)",
    )
      .bind(new Date().toISOString(), new Date().toISOString())
      .run();
    await expect(
      env.DB.prepare("UPDATE teams SET workspace_id='foreign' WHERE id=?")
        .bind(ids.platform)
        .run(),
    ).rejects.toThrow(/issue_parent_workspace/);
    await env.DB.prepare(
      "INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES('foreign-team','foreign','Foreign','FAR',?,?)",
    )
      .bind(new Date().toISOString(), new Date().toISOString())
      .run();
    await expect(
      env.DB.prepare("UPDATE issues SET team_id='foreign-team' WHERE id=?")
        .bind(b.id)
        .run(),
    ).rejects.toThrow(/issue_parent_workspace/);
    await env.DB.prepare("DELETE FROM teams WHERE id='foreign-team'").run();
    await env.DB.prepare(
      "DELETE FROM workspace_settings WHERE id='foreign'",
    ).run();
  },
);
contractWith(
  it,
  "REL-006 ISSUE-006 OPS-001",
  "parent admission rechecks native actor and selected issue version before activity",
  async () => {
    const a = await create(),
      b = await create(),
      before = await receipt();
    let fired = 0;
    const db = beforeCommit(
      (sql) => sql.includes("parent admission denied"),
      async () => {
        fired++;
        await env.DB.prepare("UPDATE issues SET version=version+1 WHERE id=?")
          .bind(b.id)
          .run();
      },
    );
    const stale = await parent(b, a.identifier, db);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: "stale_version",
      version: 2,
    });
    expect(fired).toBe(1);
    const after = await receipt();
    expect(after.issue_activity).toEqual(before.issue_activity);
    expect(
      await env.DB.prepare(
        "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
      )
        .bind(b.id)
        .first("parent_issue_id"),
    ).toBeNull();
    const owner = await sampleOwner();
    const peer = await samplePeer(owner);
    const child = await create();
    const initial = await receipt();
    let removed = 0;
    const raced = beforeCommit(
      (sql) => sql.includes("parent admission denied"),
      async () => {
        removed++;
        await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
          .bind(new Date().toISOString(), peer.id)
          .run();
      },
    );
    const response = await createApiApp().request(
      origin + `/issues/${child.identifier}/parent`,
      {
        method: "PATCH",
        headers: {
          host: new URL(origin).host,
          origin,
          cookie: peer.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: child.version,
          parentIdentifier: a.identifier,
        }),
      },
      { ...sampleBindings, DB: raced },
    );
    expect(response.status).toBe(401);
    expect(removed).toBe(1);
    expect(await receipt()).toEqual(initial);
    expect(
      await env.DB.prepare("SELECT * FROM issue_parents WHERE issue_id=?")
        .bind(child.id)
        .first(),
    ).toBeNull();
    await sampleSession(peer.cookie, 401);
    await sampleSession(owner);
  },
);
contractWith(
  it,
  "REL-006 ISSUE-010",
  "raw SQL parent deletion removes direct-child links through the cascading foreign key",
  async () => {
    const root = await create(),
      child = await create(),
      grandchild = await create();
    await env.DB.prepare(
      "INSERT INTO issue_parents(parent_issue_id,issue_id,created_at) VALUES(?,?,'2026-10-08T00:00:00.000Z') ON CONFLICT(issue_id) DO UPDATE SET parent_issue_id=excluded.parent_issue_id",
    )
      .bind(root.id, child.id)
      .run();
    await env.DB.prepare(
      "INSERT INTO issue_parents(parent_issue_id,issue_id,created_at) VALUES(?,?,'2026-10-08T00:00:00.000Z') ON CONFLICT(issue_id) DO UPDATE SET parent_issue_id=excluded.parent_issue_id",
    )
      .bind(child.id, grandchild.id)
      .run();
    await env.DB.prepare("DELETE FROM issues WHERE id=?").bind(root.id).run();
    expect(
      await env.DB.prepare(
        "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
      )
        .bind(child.id)
        .first("parent_issue_id"),
    ).toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT parent_issue_id FROM issue_parents WHERE issue_id=?",
      )
        .bind(grandchild.id)
        .first("parent_issue_id"),
    ).toBe(child.id);
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
    const projected = await call(`/issues/${child.identifier}`);
    expect(projected.status).toBe(200);
    expect(await projected.json()).toMatchObject({ parent: null });
  },
);
