import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  aggregateReviewReports,
  createReviewStageDirectory,
  runReviewGroups,
} from "./e2e/review-stage-support.mjs";

const families = [
  "inline",
  "ux",
  "contrast",
  "navigation",
  "cycle",
  "collaboration",
  "setup",
];

async function probeFamilies(failure?: string) {
  const started: string[] = [],
    completed: string[] = [];
  let live = 0;
  const run = runReviewGroups(
    async (group: string, env: NodeJS.ProcessEnv) => {
      assert.equal(
        live,
        0,
        "the preceding child has exited before another starts",
      );
      live++;
      started.push(group);
      const status = await new Promise((done, reject) => {
        const child = spawn(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `
        import assert from "node:assert/strict";
        assert.equal(process.env.VECTOR_PROOF_CASE, undefined);
        assert.equal(process.env.VECTOR_BASELINE_PROOF, undefined);
        assert.equal(process.env.VECTOR_PROOF_GROUP, ${JSON.stringify(group)});
        process.exit(process.env.VECTOR_PROOF_GROUP === ${JSON.stringify(failure)} ? 9 : 0);
      `,
          ],
          { env, stdio: "inherit" },
        );
        child.on("error", reject);
        child.on("close", done);
      });
      live--;
      completed.push(group);
      return status;
    },
    {
      ...process.env,
      VECTOR_PROOF_GROUP: "delay",
      VECTOR_PROOF_CASE: "never matches ordinary cases",
      VECTOR_BASELINE_PROOF: "1",
    },
  );
  if (failure)
    await assert.rejects(run, (error: AggregateError) => {
      assert.equal(error.errors.length, 1);
      assert.match(error.errors[0].message, new RegExp(`${failure}:`));
      return true;
    });
  else await run;
  assert.deepEqual(started, families);
  assert.deepEqual(completed, families);
  assert.equal(live, 0);
}

test("ordinary proof launches every genuine child family sequentially despite diagnostic selectors", async () => {
  await probeFamilies();
});

test("a nonzero child fails ordinary proof after every other family has executed", async () => {
  await probeFamilies("ux");
});

test("review reports retain every child capture, validate binding and bytes, and preserve parent captures", async () => {
  const root = resolve(".artifacts/verification");
  await mkdir(root, { recursive: true });
  const scratch = await mkdtemp(resolve(root, "review-orchestration-test-"));
  try {
    const directory = resolve(scratch, "review-proof");
    await mkdir(directory);
    await writeFile(
      resolve(directory, "same-state.png"),
      "ordinary parent capture",
    );
    const staging = await createReviewStageDirectory(directory);
    const binding = {
      sourceInputDigest: "source",
      builtWorkerHashes: { worker: "worker" },
      builtClientHashes: { client: "client" },
    };
    for (const group of families) {
      const childDirectory = resolve(staging, group);
      await mkdir(childDirectory);
      const name = `${group}-state`;
      const bytes = Buffer.from(`${group} actual capture bytes`);
      const row = {
        name,
        filename: `${name}.png`,
        sourceInputDigest: "source",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
      await writeFile(resolve(childDirectory, row.filename), bytes);
      await writeFile(
        resolve(childDirectory, "audits.json"),
        JSON.stringify({ binding, results: [{ name, controls: [group] }] }),
      );
      await writeFile(
        resolve(childDirectory, "regressions.json"),
        JSON.stringify([{ name: `${group}-case`, passed: true }]),
      );
      await writeFile(
        resolve(childDirectory, "manifest.json"),
        JSON.stringify({ binding, captures: [row] }),
      );
    }
    const changed = resolve(staging, "ux/manifest.json");
    const original = await readFile(changed, "utf8");
    await writeFile(
      changed,
      original.replace('"source"', '"different source"'),
    );
    await assert.rejects(
      aggregateReviewReports(staging, directory, binding, true),
      /capture binding matches/,
    );
    await writeFile(changed, original);
    await writeFile(resolve(staging, "ux/ux-state.png"), "tampered bytes");
    await assert.rejects(
      aggregateReviewReports(staging, directory, binding, true),
      /retained PNG matches/,
    );
    await writeFile(
      resolve(staging, "ux/ux-state.png"),
      "ux actual capture bytes",
    );
    const report = await aggregateReviewReports(
      staging,
      directory,
      binding,
      true,
    );
    assert.deepEqual(
      report.results.map((row: { name: string }) => row.name),
      families.map((group) => `${group}-state`),
    );
    const manifest = JSON.parse(
      await readFile(resolve(directory, "manifest.json"), "utf8"),
    );
    assert.deepEqual(manifest.binding, binding);
    assert.equal(manifest.captures.length, families.length);
    for (const row of manifest.captures)
      assert.equal(
        createHash("sha256")
          .update(await readFile(resolve(directory, row.filename)))
          .digest("hex"),
        row.sha256,
      );
    assert.equal(
      JSON.parse(await readFile(resolve(directory, "regressions.json"), "utf8"))
        .length,
      families.length,
    );
    assert.equal(
      await readFile(resolve(directory, "ordinary/same-state.png"), "utf8"),
      "ordinary parent capture",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
