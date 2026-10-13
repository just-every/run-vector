import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { createApiApp } from "../../src/core/app/api";
import { createUlid } from "../../src/core/shared/ids";
import { collaborationFixture } from "./collaboration-fixture";
import { bindings, origin } from "./base-auth-fixture";

for (const method of ["POST", "DELETE"] as const)
  for (const stale of [false, true])
    contractWith(
      it,
      "BASE-ACCESS-002 BASE-ACCESS-004 ISSUE-006",
      `dependency ${method} ${stale ? "stale" : "successful"} projection protects both endpoints during every reauthorization race`,
      async () => {
        for (const race of [
          "none",
          "session",
          "session-after-auth",
          "removed",
          "membership",
          "current",
          "related",
        ] as const) {
          try {
            const f = await collaborationFixture();
            const actor = f.bob;
            const cookie = f.bobCookie;
            expect(cookie.startsWith("operator_session_local_15920=")).toBe(
              true,
            );
            const current = await f.create({
              title: "Private current dependency",
            });
            const related = await f.create({
              title: "Private related dependency",
            });
            const path = `/issues/${current.identifier}/dependencies`;
            const input = {
              expectedVersion: current.version,
              relatedIdentifier: related.identifier,
              relatedVersion: related.version,
              direction: "blocks",
            };
            if (method === "DELETE") {
              const added = await f.call(path, "POST", input);
              expect(added.status).toBe(200);
              const dto = (await added.json()) as {
                issue: { version: number };
                relatedIssue: { version: number };
              };
              input.expectedVersion = dto.issue.version;
              input.relatedVersion = dto.relatedIssue.version;
            }
            const workspace = createUlid(new Date());
            const team = createUlid(new Date());
            const status = createUlid(new Date());
            const originalWorkspace = await env.DB.prepare(
              "SELECT workspace_id FROM operators WHERE id=?",
            )
              .bind(actor)
              .first<string>("workspace_id");
            await env.DB.batch([
              env.DB.prepare(
                "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)",
              ).bind(workspace, "Other workspace", "UTC", "now", "now"),
              env.DB.prepare(
                "INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES(?,?,?,?,?,?)",
              ).bind(team, workspace, "Other team", "OTHER", "now", "now"),
              env.DB.prepare(
                "INSERT INTO workflow_statuses VALUES(?,?,?,?,?,?,?)",
              ).bind(status, team, "Todo", "unstarted", 0, "now", "now"),
            ]);

            let projections = 0;
            let nativeReauthorized = false;
            let fired = false;
            const changeAccess = async () => {
              fired = true;
              if (race === "session" || race === "session-after-auth")
                await env.DB.prepare(
                  "UPDATE oa_sessions SET revoked_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
                )
                  .bind(Date.now(), actor)
                  .run();
              else if (race === "removed")
                await env.DB.prepare(
                  "UPDATE operators SET removed_at=? WHERE id=?",
                )
                  .bind(new Date().toISOString(), actor)
                  .run();
              else if (race === "membership")
                await env.DB.prepare(
                  "UPDATE operators SET workspace_id=? WHERE id=?",
                )
                  .bind(workspace, actor)
                  .run();
              else
                await env.DB.prepare(
                  "UPDATE issues SET team_id=?,status_id=? WHERE id=?",
                )
                  .bind(
                    team,
                    status,
                    race === "current" ? current.id : related.id,
                  )
                  .run();
            };
            // These proxies await genuine D1 results, then commit a competing D1
            // change before the route resumes. Authentication and DTOs stay native.
            const wrap = (
              statement: D1PreparedStatement,
              query: string,
            ): D1PreparedStatement =>
              new Proxy(statement, {
                get(target, key) {
                  if (key === "bind")
                    return (...values: unknown[]) =>
                      wrap(target.bind(...values), query);
                  if (key === "all")
                    return async () => {
                      const result = await target.all();
                      if (
                        query.includes(
                          "SELECT id,actor_name FROM issue_activity",
                        )
                      ) {
                        projections += 1;
                        if (projections === 2 && race === "session")
                          await changeAccess();
                      }
                      return result;
                    };
                  if (key === "first")
                    return async (column?: string) => {
                      const result = await target.first(column);
                      if (
                        projections === 2 &&
                        query.includes(
                          "SELECT o.id,o.name,o.email FROM vector_auth_operators m",
                        )
                      ) {
                        nativeReauthorized = true;
                        if (!fired && race !== "none" && race !== "session")
                          await changeAccess();
                      }
                      return result;
                    };
                  const value = Reflect.get(target, key, target);
                  return typeof value === "function"
                    ? value.bind(target)
                    : value;
                },
              });
            const db = new Proxy(env.DB, {
              get(target, key) {
                if (key === "prepare")
                  return (query: string) => wrap(target.prepare(query), query);
                const value = Reflect.get(target, key, target);
                return typeof value === "function" ? value.bind(target) : value;
              },
            });
            try {
              const response = await createApiApp().request(
                origin + path,
                {
                  method,
                  headers: {
                    origin,
                    host: new URL(origin).host,
                    cookie,
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({
                    ...input,
                    expectedVersion: input.expectedVersion + (stale ? 1 : 0),
                  }),
                },
                { ...bindings, DB: db },
              );
              const text = await response.text();
              expect(projections).toBe(2);
              expect(fired).toBe(race !== "none");
              if (race !== "session") expect(nativeReauthorized).toBe(true);
              if (race === "none") {
                expect(response.status).toBe(stale ? 409 : 200);
                const dto = JSON.parse(text);
                const increment = stale ? 0 : 1;
                expect(dto.issue.identifier).toBe(current.identifier);
                expect(dto.relatedIssue.identifier).toBe(related.identifier);
                expect(dto.issue.version).toBe(
                  input.expectedVersion + increment,
                );
                expect(dto.relatedIssue.version).toBe(
                  input.relatedVersion + increment,
                );
                if (stale) {
                  expect(dto.error).toBe("stale_version");
                  expect(dto.version).toBe(dto.issue.version);
                  expect(dto.relatedVersion).toBe(dto.relatedIssue.version);
                }
              } else {
                expect(response.status).toBe(
                  race === "session" ||
                    race === "session-after-auth" ||
                    race === "removed" ||
                    (race === "membership" && !stale)
                    ? 401
                    : 404,
                );
                expect(JSON.parse(text).error).toEqual(expect.any(String));
                expect(
                  Object.keys(JSON.parse(text)).every(
                    (key) => key === "error" || key === "message",
                  ),
                ).toBe(true);
                for (const privateValue of [
                  current.identifier,
                  related.identifier,
                  "Private current dependency",
                  "Private related dependency",
                  "relatedIssue",
                ])
                  expect(text).not.toContain(privateValue);
              }
              const versions = await env.DB.prepare(
                "SELECT id,version FROM issues WHERE id IN (?,?)",
              )
                .bind(current.id, related.id)
                .all<{ id: string; version: number }>();
              expect(
                versions.results.find((row) => row.id === current.id)?.version,
              ).toBe(input.expectedVersion + (stale ? 0 : 1));
              expect(
                versions.results.find((row) => row.id === related.id)?.version,
              ).toBe(input.relatedVersion + (stale ? 0 : 1));
              const edges = await env.DB.prepare(
                "SELECT count(*) n FROM issue_dependencies WHERE blocking_issue_id=? AND blocked_issue_id=?",
              )
                .bind(current.id, related.id)
                .first<number>("n");
              expect(edges).toBe(
                method === "POST" ? (stale ? 0 : 1) : stale ? 1 : 0,
              );
            } finally {
              await env.DB.batch([
                env.DB.prepare(
                  "UPDATE operators SET removed_at=NULL,workspace_id=? WHERE id=?",
                ).bind(originalWorkspace, actor),
                env.DB.prepare(
                  "UPDATE issues SET team_id=?,status_id=? WHERE id=?",
                ).bind(f.initial.teams[0].id, current.status.id, current.id),
                env.DB.prepare(
                  "UPDATE issues SET team_id=?,status_id=? WHERE id=?",
                ).bind(f.initial.teams[0].id, related.status.id, related.id),
                env.DB.prepare("DELETE FROM workflow_statuses WHERE id=?").bind(
                  status,
                ),
                env.DB.prepare(
                  "DELETE FROM team_issue_history WHERE team_id=?",
                ).bind(team),
                env.DB.prepare("DELETE FROM teams WHERE id=?").bind(team),
                env.DB.prepare(
                  "DELETE FROM workspace_settings WHERE id=?",
                ).bind(workspace),
              ]);
            }
          } finally {
            // Each phase is an independent native race with a fresh owner sign-in.
            await env.DB.batch([
              env.DB.prepare("DELETE FROM access_rate_limits"),
              env.DB.prepare("DELETE FROM oa_limits"),
            ]);
          }
        }
      },
    );
