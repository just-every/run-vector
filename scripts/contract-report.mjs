import { verificationDirectory } from './verification-paths.mjs';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
const root = verificationDirectory;
const read = async (name) =>
  JSON.parse(await readFile(root + "/" + name, "utf8"));
const [checks, runtime, matrix, origins] = await Promise.all([
  read("check-results.json"),
  read("runtime-results.json"),
  read("session-matrix.json"),
  read("origin-consistency.json"),
]);
assert.equal(
  checks.passed,
  true,
  "Run the complete verification before registering coverage.",
);
assert.equal(runtime.passed, true);
assert.equal(matrix.positive.status, 200);
assert.equal(matrix.positive.serialization, "true");
assert.ok(matrix.positive.decodedResult?.id);
assert.equal(origins.positiveStatus, 200);
assert.ok(origins.originProbes.every((p) => p.status === 403));
for (const state of ["missing", "expired", "revoked"]) {
  for (const surface of [
    "/api",
    "/api/session",
    "/api/current",
    "/api/unknown",
    "/app",
    "/app/my-work",
    "/app/my-work/FLW-842",
    "/app/current/FLW-842",
    "/app/projects",
    "/app/projects/01J00000000000000000000040",
    "/app/new-issue",
    "/app/issues/FLW-842",
    "/app/no-such-page",
    "loadOperator",
  ]) {
    const row = matrix.matrix.find(
      (r) => r.state === state && r.surface === surface,
    );
    assert.ok(row, state + " " + surface);
    assert.equal(
      row.status,
      surface.startsWith("/api") ? 401 : surface === "loadOperator" ? 200 : 302,
    );
  }
}
async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? sources(directory + "/" + entry.name)
          : [directory + "/" + entry.name],
      ),
    )
  ).flat();
}
const tagged = new Set();
for (const name of await sources("tests")) {
  const source = await readFile(name, "utf8");
  for (const match of source.matchAll(/(?:BASE-)?[A-Z]+-\d{3}/g))
    tagged.add(match[0]);
}
const administration = await read("admin-browser/admin-runtime-results.json");
assert.equal(administration.passed, true, "Administration browser journey must pass before registering its partial evidence.");
const administrationIds = new Set(administration.checks.filter(check => check.passed).map(check => check.id));
for (const id of ["TEAM-001", "TEAM-002", "TEAM-003", "TEAM-004", "ISSUE-014", "ISSUE-007", "PROJ-001", "PROJ-002", "PROJ-009", "CYCLE-001", "CYCLE-002", "OPS-003"]) {
  for (const width of [1440, 390]) assert.ok(administration.checks.some(check => check.id === id && check.width === width && check.passed), `${id}: administration browser at ${width}`);
}
for (const capture of administration.results) {
  assert.equal(capture.sourceCommit, administration.sourceCommit);
  assert.equal(capture.sourceInputDigest, administration.sourceInputDigest);
  assert.deepEqual(capture.builtWorkerHashes, administration.builtWorkerHashes);
  assert.deepEqual(capture.builtClientHashes, administration.builtClientHashes);
  assert.equal(createHash("sha256").update(await readFile(root + "/admin-browser/" + capture.capture)).digest("hex"), capture.captureHash);
  assert.ok(capture.geometry.documentWidth <= capture.geometry.viewportWidth);
  assert.ok(capture.axe.every(row => !["serious", "critical"].includes(row.impact)));
}
for (const database of administration.databases) assert.equal(createHash("sha256").update(await readFile(root + "/admin-browser/" + database.file)).digest("hex"), database.sha256);

const collaboration = await read("collaboration-browser/collaboration-runtime-results.json");
assert.equal(collaboration.passed, true, "Collaboration browser journey must pass before registering partial evidence.");
const collaborationIds = new Set(collaboration.checks.filter(check => check.passed).map(check => check.id));
for (const id of ["NOTIFY-001", "NOTIFY-002", "NOTIFY-003", "NOTIFY-004", "NOTIFY-006", "ISSUE-006", "ISSUE-013"]) {
  for (const width of [1440, 390]) assert.ok(collaboration.checks.some(check => check.id === id && check.width === width && check.passed), `${id}: collaboration browser at ${width}`);
}
for (const capture of collaboration.results) {
  assert.equal(capture.sourceCommit, collaboration.sourceCommit);
  assert.equal(capture.sourceInputDigest, collaboration.sourceInputDigest);
  assert.deepEqual(capture.builtWorkerHashes, collaboration.builtWorkerHashes);
  assert.deepEqual(capture.builtClientHashes, collaboration.builtClientHashes);
  assert.equal(createHash("sha256").update(await readFile(root + "/collaboration-browser/" + capture.capture)).digest("hex"), capture.captureHash);
  assert.ok(capture.geometry.documentWidth <= capture.geometry.viewportWidth);
  assert.ok(capture.axe.every(row => !["serious", "critical"].includes(row.impact)));
}
for (const width of [1440, 390]) {
  for (const name of ["inbox-assignment", "inbox-description-mention", "inbox-comment-mention-overlap", "inbox-followed-comment", "inbox-new-description-edit-mention"]) assert.ok(collaboration.timings.some(timing => timing.width === width && timing.name === name), `${width}: ${name} live timing`);
  const origins = new Set(collaboration.timings.filter(timing => timing.width === width).map(timing => timing.recipientTimeOrigin));
  assert.equal(origins.size, 1, `${width}: all live windows use the same recipient document`);
  for (const status of ["failed", "uncertain"]) assert.ok(collaboration.fixtures.some(fixture => fixture.width === width && fixture.status === status && fixture.source.startsWith("test-only native D1 presentation fixture")), `${width}: explicit ${status} presentation fixture provenance`);
  assert.ok(collaboration.fixtures.some(fixture => fixture.width === width && fixture.paginationRows > 30 && fixture.source.startsWith("31 actual native UI comments")), `${width}: real pagination source`);
  assert.ok(collaboration.installations.some(installation => installation.width === width && installation.productEmailEnabled === false && installation.nativeAuthenticationPassed && installation.inboxRows === 1 && installation.deliveryIntents === 0 && installation.developmentCaptures === 0), `${width}: explicit disabled installation remains authenticated`);
}
for (const timing of collaboration.timings) {
  assert.ok(timing.elapsedMs <= 5000);
  assert.equal(timing.measuredBeforeSubmit, true);
}
for (const database of collaboration.databases) assert.equal(createHash("sha256").update(await readFile(root + "/collaboration-browser/" + database.file)).digest("hex"), database.sha256);

const rows = [];
for (const document of ["CONTRACT.md", "BASELINE.md"]) {
  const text = await readFile(document, "utf8");
  for (const match of text.matchAll(
    /\*\*((?:BASE-)?[A-Z]+-[A-Z]*-?\d{3})\s+—/g,
  )) {
    const id = match[1];
    rows.push({
      id,
      document,
      status:
        id === "BASE-ACCESS-002"
          ? "satisfied-local"
          : tagged.has(id)
            ? "partial-evidence"
            : "pending",
      evidence:
        id === "BASE-ACCESS-002"
          ? [
              "check-results.json",
              "session-matrix.json",
              "origin-consistency.json",
              "runtime-results.json",
            ]
          : [
              ...(administrationIds.has(id) ? ["admin-browser/admin-runtime-results.json", "admin-browser/captures.json", ...administration.databases.map(row => "admin-browser/" + row.file)] : []),
              ...(collaborationIds.has(id) ? ["collaboration-browser/collaboration-runtime-results.json", "collaboration-browser/captures.json", ...collaboration.databases.map(row => "collaboration-browser/" + row.file)] : []),
            ],
    });
  }
}
assert.ok(rows.some((r) => r.id === "BASE-ACCESS-002"));
const evidenceHashes = {};
for (const name of [
  "check-results.json",
  "session-matrix.json",
  "origin-consistency.json",
  "runtime-results.json",
  "admin-browser/admin-runtime-results.json",
  "admin-browser/captures.json",
  "collaboration-browser/collaboration-runtime-results.json",
  "collaboration-browser/captures.json",
  ...collaboration.databases.map(row => "collaboration-browser/" + row.file),
  ...administration.databases.map(row => "admin-browser/" + row.file),
])
  evidenceHashes[name] = createHash("sha256")
    .update(await readFile(root + "/" + name))
    .digest("hex");
await writeFile(
  root + "/contract-report.json",
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      scope:
        "Local synthetic Worker only. Test tags indicate partial evidence, never automatic clause satisfaction. No complete product or baseline pack claim.",
      evidenceHashes,
      clauses: rows,
    },
    null,
    2,
  ),
);
console.log(
  "Registered the full native session transport matrix under BASE-ACCESS-002; other clauses remain partial or pending.",
);
