import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { searchWorkspace } from "../../src/core/features/search";
import { SearchAccessError } from "../../src/core/features/search/access";
import { testSessionHash as digest, testSessionFence } from "./native-fixture";
import { testCookie } from "./native-fixture";
import {
  beforeSearchRead,
  searchFixture,
  searchId,
  searchNow,
} from "./search-fixture";

it("[SEARCH-001 SEARCH-002 OPS-001] primary admission is rechecked after lookup and after an index failure", async () => {
  const f = await searchFixture(),
    exact = await f.issue("Exact race");
  // Keep a second real operator so the last-owner guard permits the removal
  // race itself; a rejected fixture mutation would not exercise admission.
  await env.DB.prepare(
    "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES('admission-other',?,'Other','admission-other@search.test',?,?)",
  )
    .bind(f.actor.workspace_id, searchNow, searchNow)
    .run();
  const cookie = await testCookie(env.DB, f.actor.id),
    hash = await digest(cookie.split("=")[1]);
  const workspace = searchId();
  await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)")
    .bind(workspace, "Other", "UTC", searchNow, searchNow)
    .run();
  const mutations = [
    {
      change: "UPDATE operators SET removed_at='2026-10-01' WHERE id=?",
      value: f.actor.id,
      restore: "UPDATE operators SET removed_at=NULL WHERE id=?",
    },
    {
      change:
        "UPDATE operators SET workspace_id=? WHERE id='" + f.actor.id + "'",
      value: workspace,
      restore:
        "UPDATE operators SET workspace_id='" +
        f.actor.workspace_id +
        "' WHERE id=?",
    },
    {
      change:
        "UPDATE oa_sessions SET revoked_at='2026-10-01' WHERE token_hash=?",
      value: hash,
      restore:
        "UPDATE oa_sessions SET revoked_at=NULL WHERE token_hash=?",
    },
  ];
  for (const broken of [false, true]) {
    if (broken) await env.DB.prepare("DROP TABLE search_issues").run();
    for (const mutation of mutations) {
      let fired = false,
        committed = false;
      const db = beforeSearchRead(async (sql) => {
        if (
          !fired &&
          sql.includes(
            broken ? "AS issue FROM operators actor" : "json_group_array",
          )
        ) {
          fired = true;
          await env.DB.prepare(mutation.change).bind(mutation.value).run();
          committed = true;
        }
      });
      await expect(
        searchWorkspace(db, f.actor.id, exact.identifier, false, await testSessionFence(env.DB,cookie)),
        `broken=${broken}; mutation=${mutation.change}`,
      ).rejects.toBeInstanceOf(SearchAccessError);
      expect(fired).toBe(true);
      expect(committed).toBe(true);
      await env.DB.prepare(mutation.restore)
        .bind(mutation.value === workspace ? f.actor.id : mutation.value)
        .run();
    }
  }
});
