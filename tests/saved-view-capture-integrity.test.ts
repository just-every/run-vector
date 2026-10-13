import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertSavedViewCaptureIntegrity } from "./e2e/saved-view-capture-integrity.mjs";

const hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
async function captures(run: (directory: string) => Promise<void>) {
  const root = resolve(".artifacts/verification/saved-view-capture-integrity");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(resolve(root, "run-"));
  try {
    await writeFile(resolve(directory, "shared.png"), "shared capture fixture");
    await writeFile(resolve(directory, "private.png"), "private capture fixture");
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const shared = { name: "shared palette", capture: "shared.png", sha256: hash("shared capture fixture") };
const privateView = { name: "private palette", capture: "private.png", sha256: hash("private capture fixture") };

test("capture guard verifies every unique retained capture against its recorded bytes", async () => {
  await captures(directory => assertSavedViewCaptureIntegrity([shared, privateView], directory));
});

test("capture guard refuses duplicate physical paths even when their hashes match", async () => {
  await captures(async directory => {
    await assert.rejects(assertSavedViewCaptureIntegrity([shared, { ...shared, name: "second state", capture: "./shared.png" }], directory), /duplicate capture path/);
  });
});

test("capture guard refuses an overwritten capture with a stale manifest hash", async () => {
  await captures(async directory => {
    await assert.rejects(assertSavedViewCaptureIntegrity([shared, { ...privateView, sha256: shared.sha256 }], directory), /retained capture matches manifest hash/);
  });
});
