import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { updateIssueRecord } from "../../src/core/features/issue-edit/repository";
import {
  mutationDatabase,
  MutationAccessError,
} from "../../src/core/features/auth/mutation-database";
import { requireOperator } from "../../src/core/features/auth/service";
import { createUlid } from "../../src/core/shared/ids";
import { setupAdministration } from "./administration-fixture";
import { actor, bindings, invite, request, signIn } from "./base-auth-fixture";
import { beforeCommit } from "./removal-interleaving";

let workspace: Awaited<ReturnType<typeof setupAdministration>>;
let otherWorkspace: string;
beforeAll(async () => {
  workspace = await setupAdministration();
  otherWorkspace = createUlid(new Date());
});

async function changeActor(operator: string, change: "removed" | "workspace") {
  const now = new Date().toISOString();
  if (change === "removed") {
    await env.DB.prepare("UPDATE operators SET removed_at=? WHERE id=?")
      .bind(now, operator)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,'UTC',?,?)",
    )
      .bind(otherWorkspace, "Separate workspace", now, now)
      .run();
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
      .bind(otherWorkspace, operator)
      .run();
  }
}

async function restoreWorkspace(operator: string, workspaceId: string) {
  await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
    .bind(workspaceId, operator)
    .run();
  await env.DB.prepare("DELETE FROM workspace_settings WHERE id=?")
    .bind(otherWorkspace)
    .run();
}

async function issueState(id: string) {
  return {
    issue: await env.DB.prepare("SELECT * FROM issues WHERE id=?")
      .bind(id)
      .first(),
    activity: (
      await env.DB.prepare(
        "SELECT * FROM issue_activity WHERE issue_id=? ORDER BY id",
      )
        .bind(id)
        .all()
    ).results,
  };
}

// Schedule a real database change immediately before a direct repository
// caller executes its single guarded statement, without changing that statement.
function beforeNoopRun(action: () => Promise<void>) {
  let ran = false;
  function statement(
    raw: D1PreparedStatement,
    sql: string,
  ): D1PreparedStatement {
    return new Proxy(raw, {
      get(target, key) {
        if (key === "bind")
          return (...args: unknown[]) => statement(target.bind(...args), sql);
        if (key === "run")
          return async () => {
            if (!ran && sql.includes("UPDATE issues SET version=version")) {
              ran = true;
              await action();
            }
            return target.run();
          };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  return {
    ran: () => ran,
    db: new Proxy(env.DB, {
      get(target, key) {
        if (key === "prepare")
          return (sql: string) => statement(target.prepare(sql), sql);
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

it("[ISSUE-006][ISSUE-007] a native session no-op preserves the entire issue and activity history", async () => {
  const title = "Unchanged native issue";
  const issue = await workspace.create({ title });
  const before = await issueState(issue.id);
  const response = await workspace.call(
    "/issues/" + issue.identifier,
    "PATCH",
    {
      expectedVersion: issue.version,
      title,
    },
  );
  expect(response.status).toBe(200);
  expect(((await response.json()) as { version: number }).version).toBe(
    issue.version,
  );
  expect(await issueState(issue.id)).toEqual(before);
});

it("[BASE-ACCESS-004][ISSUE-006] a direct no-op rejects removal or a workspace change at its guarded statement", async () => {
  const title = "Guarded direct no-op";
  const issue = await workspace.create({ title });
  const before = await issueState(issue.id);
  const original = await env.DB.prepare(
    "SELECT workspace_id FROM operators WHERE id=?",
  )
    .bind(workspace.owner)
    .first<{ workspace_id: string }>();
  for (const change of ["removed", "workspace"] as const) {
    const operator = await actor(
      await invite(`direct-${change}@base.test`, workspace.cookie),
    );
    const interleaved = beforeNoopRun(() => changeActor(operator, change));
    try {
      expect(
        await updateIssueRecord(interleaved.db, issue.identifier, operator, {
          expectedVersion: issue.version,
          title,
        }),
      ).toBe("stale");
      expect(interleaved.ran()).toBe(true);
      expect(await issueState(issue.id)).toEqual(before);
    } finally {
      await restoreWorkspace(operator, original!.workspace_id);
    }
  }
});

it("[BASE-ACCESS-002][ISSUE-006] a no-op retains an explicitly bound native session after sign-out", async () => {
  const title = "Revoked native no-op";
  const issue = await workspace.create({ title });
  const before = await issueState(issue.id);
  const cookie = await signIn();
  const identity = await requireOperator(
    bindings,
    new Request(bindings.APP_ORIGIN + "/api/session", {
      headers: {
        cookie,
        host: new URL(bindings.APP_ORIGIN).host,
        origin: bindings.APP_ORIGIN,
      },
    }),
  );
  expect(identity?.id).toBe(workspace.owner);
  expect(typeof identity?.fence).toBe("object");
  const scoped = mutationDatabase(env.DB, identity!.id, identity!.fence);
  expect((await request("/auth/signout", "POST", {}, cookie)).status).toBe(200);
  await expect(
    updateIssueRecord(scoped, issue.identifier, workspace.owner, {
      expectedVersion: issue.version,
      title,
    }),
  ).rejects.toBeInstanceOf(MutationAccessError);
  expect(await issueState(issue.id)).toEqual(before);
});

it("[BASE-ACCESS-002][BASE-ACCESS-004][ISSUE-006] native no-op routes deny sign-out, removal and workspace races without exposing the issue", async () => {
  const title = "Native route no-op";
  const issue = await workspace.create({ title });
  const before = await issueState(issue.id);
  const original = await env.DB.prepare(
    "SELECT workspace_id FROM operators WHERE id=?",
  )
    .bind(workspace.owner)
    .first<{ workspace_id: string }>();
  for (const change of ["removed", "workspace", "signout"] as const) {
    const cookie = await invite(`route-${change}@base.test`, workspace.cookie);
    const operator = await actor(cookie);
    let intervened = false;
    const db = beforeCommit(
      (sql) => sql.includes("UPDATE issues SET version=version"),
      async () => {
        intervened = true;
        if (change === "signout") {
          expect(
            (await request("/auth/signout", "POST", {}, cookie)).status,
          ).toBe(200);
        } else {
          await changeActor(operator, change);
        }
      },
    );
    try {
      const response = await request(
        "/api/issues/" + issue.identifier,
        "PATCH",
        {
          expectedVersion: issue.version,
          title,
        },
        cookie,
        { DB: db },
      );
      expect(intervened).toBe(true);
      expect(response.status).toBe(change === "workspace" ? 404 : 401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.error).toBe(
        change === "workspace" ? "not_found" : "unauthenticated",
      );
      expect(Object.keys(body).sort()).toEqual(["error", "message"]);
      expect(await issueState(issue.id)).toEqual(before);
    } finally {
      await restoreWorkspace(operator, original!.workspace_id);
    }
  }
});
