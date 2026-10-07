import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { Hono } from "hono";
import assert from "node:assert/strict";
import { beforeAll, inject, it } from "vitest";
import { createApiApp } from "../../src/core/app/api";
import type { AppEnvironment } from "../../src/core/app/bindings";
import { ensureSampleData } from "../../src/core/features/sample-data/service";
import {
  addNamedLink,
  commentLinkErasureStatements,
} from "../../src/core/features/links/repository";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";

// The integrated production API supplies native auth, Origin, rate, body
// handling, link registration and existing issue/comment creation.
const api = createApiApp();
const app = new Hono<AppEnvironment>().route("/api", api);
const origin = "https://vector.test";
const bindings = { ...env, APP_ORIGIN: origin };
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
  await ensureSampleData(env.DB, new Date());
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  operator = ids.sarah,
) {
  return app.request(
    origin + "/api" + path,
    {
      method,
      headers: {
        cookie: await testCookie(env.DB, operator),
        origin,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    bindings,
  );
}
async function createIssue(title: string) {
  const response = await request("/issues", "POST", {
    title,
    teamId: ids.flow,
  });
  assert.equal(response.status, 201);
  return (await response.json()) as {
    id: string;
    identifier: string;
    version: number;
  };
}
async function createComment(issue: { identifier: string }) {
  const response = await request(
    `/issues/${issue.identifier}/comments`,
    "POST",
    { body: "Link evidence" },
  );
  assert.equal(response.status, 201);
  return ((await response.json()) as { id: string }).id;
}
async function eraseComment(
  issue: { id: string; identifier: string },
  id: string,
  actor = ids.maya,
) {
  const now = new Date().toISOString();
  return env.DB.batch([
    ...commentLinkErasureStatements(env.DB, issue, id, actor, now),
    env.DB.prepare(
      "UPDATE issue_comments SET body=NULL,deleted_at=?,updated_at=? WHERE id=? AND issue_id=? AND deleted_at IS NULL",
    ).bind(now, now, id, issue.id),
  ]);
}
const countLinks = async (issueId: string) =>
  (await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM issue_links WHERE issue_id=?",
  )
    .bind(issueId)
    .first<{ n: number }>())!.n;

it("[ISSUE-009][BASE-ACCESS-002][BASE-ACCESS-004] protects link routes with native sessions and same-Origin mutation admission", async () => {
  const issue = await createIssue("Protected links"),
    path = `/issues/${issue.identifier}/links`;
  for (const method of ["GET", "POST", "DELETE"]) {
    const response = await app.request(
      origin +
        "/api" +
        path +
        (method === "DELETE" ? "/01J00000000000000000000000" : ""),
      {
        method,
        headers: { origin, "Content-Type": "application/json" },
        body:
          method === "POST"
            ? JSON.stringify({
                name: "Evidence",
                url: "https://evidence.test/",
              })
            : undefined,
      },
      bindings,
    );
    assert.equal(response.status, 401);
  }
  const cookie = await testCookie(env.DB, ids.sarah);
  assert.equal(
    (
      await app.request(
        origin + "/api" + path,
        {
          method: "POST",
          headers: {
            cookie,
            origin: "https://hostile.test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Evidence",
            url: "https://evidence.test/",
          }),
        },
        bindings,
      )
    ).status,
    403,
  );
  assert.equal(await countLinks(issue.id), 0);
});

it("[ISSUE-009][BASE-INPUT-001] rejects unsafe schemes, credentials, controls, names and malformed ownership without writing records", async () => {
  const issue = await createIssue("Invalid links"),
    path = `/issues/${issue.identifier}/links`;
  const invalidUrls = [
    "http://evidence.test/",
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///private",
    "//evidence.test/",
    "https://user:secret@evidence.test/",
    "https://user@evidence.test/",
    "https://evidence.test/\u0001",
    "https://evidence.test/%0d",
    "https://evidence.test/\\private",
    "https://evidence.test/%ZZ",
    "https://evidence.test/%7f",
    " https://evidence.test/",
  ];
  for (const url of invalidUrls)
    assert.equal(
      (await request(path, "POST", { name: "Evidence", url })).status,
      400,
      url,
    );
  for (const name of [
    "",
    "   ",
    "x".repeat(201),
    "Evidence\nnext",
    "Evidence\u0000",
    "Evidence\u0085",
  ])
    assert.equal(
      (await request(path, "POST", { name, url: "https://evidence.test/" }))
        .status,
      400,
      name,
    );
  assert.equal(
    (
      await request(path, "POST", {
        name: "Evidence",
        url: "https://evidence.test/",
        commentId: "not-an-id",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(path, "POST", {
        name: "Evidence",
        url: "https://evidence.test/",
        extra: true,
      })
    ).status,
    400,
  );
  assert.equal((await request("/issues/bad/links")).status, 400);
  assert.equal((await request(path + "/not-an-id", "DELETE")).status, 400);
  assert.equal((await request(path + "?unrecognized=true")).status, 400);
  assert.equal((await request("/issues/FLW-999999999/links")).status, 404);
  assert.equal(await countLinks(issue.id), 0);
});

it("[ISSUE-009][ISSUE-006] persists named issue/comment links and permits any active operator without changing issue version", async () => {
  const issue = await createIssue("Persistent links"),
    commentId = await createComment(issue),
    path = `/issues/${issue.identifier}/links`;
  const first = await request(
    path,
    "POST",
    {
      name: "  Customer evidence  ",
      url: "HTTPS://evidence.test/report?case=42",
    },
    ids.maya,
  );
  assert.equal(first.status, 201);
  const second = await request(path, "POST", {
    name: "Comment source",
    url: "https://evidence.test/comment",
    commentId,
  });
  assert.equal(second.status, 201);
  const listed = await request(path);
  assert.equal(listed.status, 200);
  const links = ((await listed.json()) as any).links;
  assert.equal(links.length, 2);
  assert.equal(links[0].name, "Customer evidence");
  assert.equal(links[0].url, "https://evidence.test/report?case=42");
  assert.equal(links[0].commentId, null);
  assert.equal(links[1].commentId, commentId);
  assert.ok(links.every((link: any) => link.actor && link.createdAt));
  assert.equal(
    (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
      .bind(issue.id)
      .first<{ version: number }>())!.version,
    1,
  );
  assert.equal(
    (await env.DB.prepare(
      "SELECT COUNT(*) n FROM issue_activity WHERE issue_id=? AND kind='link.created'",
    )
      .bind(issue.id)
      .first<{ n: number }>())!.n,
    2,
  );
});

it("[ISSUE-008][ISSUE-009] rejects cross-issue or deleted comments and cross-issue link deletion", async () => {
  const first = await createIssue("Owner A"),
    second = await createIssue("Owner B"),
    commentId = await createComment(first),
    path = `/issues/${first.identifier}/links`;
  assert.equal(
    (
      await request(`/issues/${second.identifier}/links`, "POST", {
        name: "Cross owner",
        url: "https://evidence.test/",
        commentId,
      })
    ).status,
    404,
  );
  const created = await request(path, "POST", {
    name: "Owned evidence",
    url: "https://evidence.test/private",
    commentId,
  });
  assert.equal(created.status, 201);
  const { id } = (await created.json()) as { id: string };
  assert.equal(
    (await request(`/issues/${second.identifier}/links/${id}`, "DELETE"))
      .status,
    404,
  );
  await eraseComment(first, commentId);
  assert.equal(
    (
      await request(path, "POST", {
        name: "Deleted comment evidence",
        url: "https://evidence.test/",
        commentId,
      })
    ).status,
    404,
  );
  assert.deepEqual(((await (await request(path)).json()) as any).links, []);
  assert.equal((await request(path + "/" + id, "DELETE")).status, 404);
  const row = await env.DB.prepare(
    "SELECT name,url,deleted_at FROM issue_links WHERE id=?",
  )
    .bind(id)
    .first<{
      name: string | null;
      url: string | null;
      deleted_at: string | null;
    }>();
  assert.equal(row!.name, null);
  assert.equal(row!.url, null);
  assert.ok(row!.deleted_at);
});

it("[ISSUE-009][BASE-DATA-003] competing deletion erases stored name/url and records exactly one actor action without retaining personal link content", async () => {
  const issue = await createIssue("Delete named evidence"),
    path = `/issues/${issue.identifier}/links`;
  const response = await request(path, "POST", {
    name: "Private person name",
    url: "https://evidence.test/private-person?email=private@example.test",
  });
  const { id } = (await response.json()) as { id: string };
  const responses = await Promise.all([
    request(path + "/" + id, "DELETE", undefined, ids.maya),
    request(path + "/" + id, "DELETE", undefined, ids.sarah),
  ]);
  assert.deepEqual(responses.map((item) => item.status).sort(), [200, 404]);
  const row = await env.DB.prepare(
    "SELECT name,url,deleted_at FROM issue_links WHERE id=?",
  )
    .bind(id)
    .first();
  assert.equal(row!.name, null);
  assert.equal(row!.url, null);
  assert.ok(row!.deleted_at);
  const activity = await env.DB.prepare(
    "SELECT actor_operator_id,next_value_json,previous_value_json FROM issue_activity WHERE issue_id=? AND kind='link.deleted'",
  )
    .bind(issue.id)
    .all();
  assert.equal(activity.results.length, 1);
  assert.ok(
    [ids.sarah, ids.maya].includes(
      activity.results[0].actor_operator_id as any,
    ),
  );
  const audit = await env.DB.prepare(
    "SELECT * FROM audit_records WHERE subject_id=? AND action='link.deleted'",
  )
    .bind(id)
    .all();
  assert.equal(audit.results.length, 1);
  const retained = JSON.stringify({
    activity: activity.results,
    audit: audit.results,
  });
  assert.ok(
    !retained.includes("private-person") &&
      !retained.includes("private@example.test") &&
      !retained.includes("Private person name"),
  );
  assert.deepEqual(((await (await request(path)).json()) as any).links, []);
});

it("[ISSUE-008][ISSUE-009] an intervening comment deletion cannot be bypassed by a stale eligibility read", async () => {
  const issue = await createIssue("Interleaved comment delete"),
    commentId = await createComment(issue);
  let intervened = false;
  const interleaved = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          intervened = true;
          await eraseComment(issue, commentId);
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  assert.equal(
    await addNamedLink(interleaved, issue, ids.sarah, {
      name: "Late evidence",
      url: "https://evidence.test/late",
      commentId,
    }),
    null,
  );
  assert.ok(intervened);
  assert.equal(await countLinks(issue.id), 0);
  assert.equal(
    (await env.DB.prepare(
      "SELECT COUNT(*) n FROM issue_activity WHERE issue_id=? AND kind='link.created'",
    )
      .bind(issue.id)
      .first<{ n: number }>())!.n,
    0,
  );
});

it("[ISSUE-008][ISSUE-009] concurrent insertion/deletion leaves a tombstone and zero active comment links; multi-link cascade audits each removal", async () => {
  const issue = await createIssue("Concurrent comment links"),
    commentId = await createComment(issue),
    path = `/issues/${issue.identifier}/links`;
  for (const name of ["First", "Second"])
    assert.equal(
      (
        await request(path, "POST", {
          name,
          url: `https://evidence.test/${name}`,
          commentId,
        })
      ).status,
      201,
    );
  const [inserted] = await Promise.all([
    request(path, "POST", {
      name: "Concurrent",
      url: "https://evidence.test/concurrent",
      commentId,
    }),
    eraseComment(issue, commentId),
  ]);
  assert.ok([201, 404].includes(inserted.status));
  const rows = await env.DB.prepare(
    "SELECT id,name,url,deleted_at FROM issue_links WHERE comment_id=?",
  )
    .bind(commentId)
    .all();
  assert.equal(rows.results.length, inserted.status === 201 ? 3 : 2);
  assert.ok(
    rows.results.every(
      (row) => row.name === null && row.url === null && row.deleted_at,
    ),
  );
  const comment = await env.DB.prepare(
    "SELECT body,deleted_at FROM issue_comments WHERE id=?",
  )
    .bind(commentId)
    .first();
  assert.equal(comment!.body, null);
  assert.ok(comment!.deleted_at);
  assert.deepEqual(((await (await request(path)).json()) as any).links, []);
  assert.equal(
    (await env.DB.prepare(
      "SELECT COUNT(*) n FROM audit_records WHERE subject_identifier=? AND action='link.deleted'",
    )
      .bind(issue.identifier)
      .first<{ n: number }>())!.n,
    rows.results.length,
  );
  assert.equal(
    (await env.DB.prepare(
      "SELECT COUNT(*) n FROM issue_activity WHERE issue_id=? AND kind='link.deleted'",
    )
      .bind(issue.id)
      .first<{ n: number }>())!.n,
    rows.results.length,
  );
  const repeated = await eraseComment(issue, commentId);
  assert.equal(repeated[0].meta.changes, 0);
  assert.equal(repeated[1].meta.changes, 0);
});
