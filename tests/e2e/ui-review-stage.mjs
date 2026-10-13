import { spawn } from "node:child_process";
import { rename } from "node:fs/promises";
import { resolve } from "node:path";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
import { assertProofBinding } from "./ui-proof-state.mjs";
import {
  aggregateReviewReports,
  createReviewStageDirectory,
  runReviewGroups,
} from "./review-stage-support.mjs";

export async function runReviewStage() {
  const directory = resolve(verificationDirectory, "review-proof");
  const staging = await createReviewStageDirectory(directory);
  try {
    const binding = await assertProofBinding();
    await runReviewGroups(async (group, env) => {
      const status = await new Promise((resolveExit, reject) => {
        const child = spawn(
          process.execPath,
          [
            group === "setup"
              ? "tests/e2e/setup-guidance-proof.mjs"
              : "tests/e2e/review-regression-runtime.mjs",
          ],
          { env, stdio: "inherit" },
        );
        child.on("error", reject);
        child.on("close", resolveExit);
      });
      // The child closes its browser and Worker before the next family starts.
      // Retain the ordinary parent captures and each child's process-local reports.
      await rename(directory, resolve(staging, group));
      return status;
    });
    await assertProofBinding();
    return await aggregateReviewReports(
      staging,
      directory,
      binding,
      process.env.VECTOR_PROOF_CAPTURE === "1",
    );
  } catch (error) {
    try {
      await rename(staging, directory);
    } catch (retentionError) {
      // Aggregation may already have restored the directory before a write failed.
      if (retentionError.code !== "ENOENT")
        throw new AggregateError(
          [error, retentionError],
          `Review failed; partial evidence remains at ${staging}`,
        );
    }
    console.error(
      `[Vector UI] Review failure evidence retained at ${directory}`,
    );
    throw error;
  }
}
