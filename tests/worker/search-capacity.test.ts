import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { searchWorkspace } from "../../src/core/features/search";
import { SEARCH_RESULT_LIMIT } from "../../src/core/features/search/service";
import { searchFixture, searchNow } from "./search-fixture";

it("[SEARCH-001 SEARCH-003] measures bounded FTS results over 5000 actual issues with comments", async (context) => {
  const f = await searchFixture();
  await env.DB.prepare(
    `WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<5000)
    INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,status_id,title,description,priority,created_at,updated_at)
    SELECT 'capacity-'||x,'CAPACITY-'||x,'CAPACITY',x,?,?,'Synthetic capacity issue '||x,'Capacitydescription','none',?,? FROM n`,
  )
    .bind(f.team.id, f.team.status, searchNow, searchNow)
    .run();
  await env.DB.prepare(
    `INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at)
    SELECT 'comment-'||id,id,?,'Capacitycomment needle '||sequence_number,?,? FROM issues WHERE origin_prefix='CAPACITY'`,
  )
    .bind(f.actor.id, searchNow, searchNow)
    .run();
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issues WHERE origin_prefix='CAPACITY'",
    ).first("n"),
  ).toBe(5000);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issue_comments WHERE body LIKE 'Capacitycomment%'",
    ).first("n"),
  ).toBe(5000);
  const start = performance.now();
  const result = await searchWorkspace(
    env.DB,
    f.actor.id,
    "Capacitycomment",
    false,
  );
  const elapsed = performance.now() - start;
  // Reported through the JSON reporter: `vitest run --reporter=json`.
  Object.assign(context.task.meta, { searchElapsedMs: elapsed });
  expect(result.issues).toHaveLength(SEARCH_RESULT_LIMIT);
  expect(new Set(result.issues.map((i) => i.id)).size).toBe(
    SEARCH_RESULT_LIMIT,
  );
  expect(result.issues.every((i) => i.identifier.startsWith("CAPACITY-"))).toBe(
    true,
  );
  // This is a local measurement, not a hosted capacity or latency claim.
  expect(elapsed).toBeLessThan(500);
}, 30000);
