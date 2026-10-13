import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function assertSavedViewCaptureIntegrity(rows, evidence) {
  assert.ok(rows.length > 0, "saved-view audits produced captures");
  const paths = new Set();
  for (const row of rows) {
    assert.equal(typeof row.capture, "string", `${row.name}: capture path exists`);
    const path = resolve(evidence, row.capture);
    assert.ok(!paths.has(path), `${row.name}: duplicate capture path ${row.capture}`);
    paths.add(path);
  }
  for (const row of rows) {
    const bytes = await readFile(resolve(evidence, row.capture));
    const actual = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actual, row.sha256, `${row.name}: retained capture matches manifest hash ${row.capture}`);
  }
}
