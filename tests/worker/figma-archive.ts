import { createServerApp } from "../../src/core/app/server";
import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import {
  httpExport,
  freshTarget,
  stageArchive,
  finalBody,
  targetCall,
  destination,
  targetBindings,
} from "./http-archive-fixture";
import { testCookie } from "./native-fixture";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import type { exerciseFigma } from "./figma-journey";

/** Download an actual HTTP archive and commit it into an independent native target. */
export async function exerciseFigmaArchive(
  f: Awaited<ReturnType<typeof exerciseFigma>>,
) {
  const encrypted = (
    await env.DB.prepare(
      "SELECT encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'figma%'",
    ).all<{ encrypted: string }>()
  ).results.map((row) => row.encrypted);
  assert.ok(encrypted.length > 0);
  const captures = (
    await env.DB.prepare(
      "SELECT * FROM vector_figma_captures ORDER BY capture_id",
    ).all()
  ).results;
  assert.ok(captures.length >= 2);
  const archive = await httpExport(f.req),
    bytes = JSON.stringify(archive);
  for (const value of [...f.secrets, ...encrypted])
    assert.equal(
      bytes.includes(value),
      false,
      "Archive excludes Figma credentials and ciphertext",
    );
  const cookie = await freshTarget(),
    job = await stageArchive(archive, cookie);
  const finalized = await targetCall(
    "/api/portability/imports/" + job + "/finalize",
    "POST",
    finalBody(archive),
    cookie,
  );
  assert.equal(finalized.status, 200, await finalized.clone().text());
  assert.deepEqual(
    (
      await destination.ARCHIVE_TARGET_DB.prepare(
        "SELECT * FROM vector_figma_captures ORDER BY capture_id",
      ).all()
    ).results,
    captures,
  );
  assert.equal(
    await destination.ARCHIVE_TARGET_DB.prepare(
      "SELECT count(*) n FROM vector_integration_secret_keys WHERE identity LIKE 'figma%'",
    ).first("n"),
    0,
  );
  const email = await env.DB.prepare("SELECT email FROM operators WHERE id=?")
    .bind(ids.sarah)
    .first<string>("email");
  const overrides = { FIRST_OWNER_EMAIL: email! };
  assert.equal(
    (await targetCall("/health", "GET", undefined, "", overrides)).status,
    200,
  );
  const restored = await testCookie(destination.ARCHIVE_TARGET_DB, ids.sarah);
  const call = (path: string, method = "GET", body?: unknown) =>
    targetCall("/api" + path, method, body, restored, overrides);
  const app = await call("/settings/integrations/figma");
  assert.equal(app.status, 200, await app.clone().text());
  assert.equal(((await app.json()) as any).requiresReentry, true);
  const connection = await call("/settings/figma");
  assert.equal(connection.status, 200);
  assert.deepEqual(await connection.json(), {
    connected: false,
    available: false,
    needsAttention: false,
    requiresReentry: true,
  });
  assert.equal((await call("/settings/figma/connect", "POST", {})).status, 409);
  assert.equal(
    (await call("/settings/integrations/figma", "POST", f.config)).status,
    200,
  );
  const fresh = await call("/settings/figma");
  assert.equal(
    ((await fresh.json()) as any).connected,
    false,
    "App re-entry never reconnects any member automatically",
  );
  assert.equal((await call("/settings/figma/connect", "POST", {})).status, 200);
  const minted = await call("/settings/integrations/tokens", "POST", {
    name: "synthetic-vector-20334",
    scopes: ["issues:write"],
  });
  assert.equal(minted.status, 201);
  const credential = (await minted.json()) as any;
  const before = await destination.ARCHIVE_TARGET_DB.prepare(
    "SELECT count(*) n FROM issues",
  ).first("n");
  const replay = await createServerApp().request(
    targetBindings.APP_ORIGIN + "/api/v1/integrations/figma/issues",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + credential.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(f.ownerCapture),
    },
    { ...targetBindings, ...overrides },
  );
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), {
    identifier: f.ownerIdentifier,
    replay: true,
  });
  assert.equal(
    await destination.ARCHIVE_TARGET_DB.prepare(
      "SELECT count(*) n FROM issues",
    ).first("n"),
    before,
  );
  const oauth = (
    await destination.ARCHIVE_TARGET_DB.prepare(
      "SELECT identity FROM vector_integration_secret_keys WHERE identity LIKE 'figma-state:%'",
    ).all()
  ).results;
  assert.equal(oauth.length, 1, "Fresh destination OAuth state is required");
}
