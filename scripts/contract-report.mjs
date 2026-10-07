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
          : [],
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
