import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { inject } from "vitest";
import { bootstrapWorkspace } from "../../src/core/features/bootstrap/repository";
import { createUlid } from "../../src/core/shared/ids";
import { bindings } from "./base-auth-fixture";

export const searchNow = "2026-10-01T00:00:00Z";
export const searchId = () => createUlid(new Date());
export async function searchFixture() {
  await applyD1Migrations(env.DB, inject("migrations"));
  await bootstrapWorkspace(env.DB, bindings);
  const actor = (await env.DB.prepare(
    "SELECT id,workspace_id FROM operators WHERE removed_at IS NULL LIMIT 1",
  ).first<{ id: string; workspace_id: string }>())!;
  const team = (await env.DB.prepare(
    "SELECT t.id,s.id status FROM teams t JOIN workflow_statuses s ON s.team_id=t.id WHERE t.workspace_id=? AND s.category='backlog' LIMIT 1",
  )
    .bind(actor.workspace_id)
    .first<{ id: string; status: string }>())!;
  const issue = async (
    title: string,
    extra: {
      project?: string;
      description?: string;
      expected?: string;
      impact?: string;
    } = {},
  ) => {
    const id = searchId(),
      identifier = "FIND-" + ++sequence;
    await env.DB.prepare(
      `INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,status_id,title,description,expected_outcome,customer_impact,priority,project_id,created_at,updated_at)
      VALUES(?,?,'FIND',?,?,?, ?,?,?,?,'none',?,?,?)`,
    )
      .bind(
        id,
        identifier,
        sequence,
        team.id,
        team.status,
        title,
        extra.description ?? "",
        extra.expected ?? null,
        extra.impact ?? null,
        extra.project ?? null,
        searchNow,
        searchNow,
      )
      .run();
    return { id, identifier, title };
  };
  const project = async (name: string) => {
    const id = searchId();
    await env.DB.prepare(
      "INSERT INTO projects(id,workspace_id,name,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,?,?,?,'planned',?,?)",
    )
      .bind(id, actor.workspace_id, name, actor.id, searchNow, searchNow)
      .run();
    return id;
  };
  const view = async (name: string, owner = actor.id, shared = false) => {
    const id = searchId();
    await env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,created_at,updated_at) VALUES(?,?,?,?,'issues',?,?,?)",
    )
      .bind(
        id,
        actor.workspace_id,
        owner,
        name,
        Number(shared),
        searchNow,
        searchNow,
      )
      .run();
    return id;
  };
  return { actor, team, issue, project, view };
}
let sequence = 10000;

// Instrument the real D1 binding, preserving real SQL/transaction execution.
export function beforeSearchRead(run: (query: string) => Promise<void>) {
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (query: string) => {
          const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
            new Proxy(statement, {
              get(stmt, method) {
                if (method === "bind")
                  return (...values: unknown[]) => wrap(stmt.bind(...values));
                if (method === "first")
                  return async (
                    ...args: Parameters<D1PreparedStatement["first"]>
                  ) => {
                    await run(query);
                    return stmt.first(...args);
                  };
                const value = Reflect.get(stmt, method, stmt);
                return typeof value === "function" ? value.bind(stmt) : value;
              },
            });
          return wrap(target.prepare(query));
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
