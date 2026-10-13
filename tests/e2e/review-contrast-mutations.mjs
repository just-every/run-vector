import assert from "node:assert/strict";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const directory = resolve(verificationDirectory, "contrast-mutations");
await mkdir(directory, { recursive: true });
const assets = resolve("dist/client/assets");
const originals = await Promise.all(
  (await readdir(assets))
    .filter((name) => name.endsWith(".css"))
    .map(async (name) => ({
      name,
      bytes: await readFile(resolve(assets, name)),
    })),
);
const target = originals.find((file) => file.bytes.includes(".stream-empty"));
assert.ok(target, "actual built stylesheet includes production stream rules");
const before = Object.fromEntries(
  originals.map((file) => [file.name, hash(file.bytes)]),
);
const results = [];
try {
  for (const [name, selector, color, assertion] of [
    [
      "selected-row",
      ".stream-row.is-selected .stream-row-meta",
      "#777281",
      "selected row details",
    ],
    ["empty-section", ".stream-empty", "#777281", "Nothing in this section"],
    [
      "decision-labels",
      ".decision-form label > span",
      "#7f7988",
      "decision labels",
    ],
  ])
    for (const width of [1440, 390]) {
      const media = width === 390 ? "max-width:600px" : "min-width:1000px";
      // Mutate only built CSS; each ordinary entrypoint invocation must reject the
      // actual computed foreground on its production background at this width.
      await writeFile(
        resolve(assets, target.name),
        Buffer.concat([
          target.bytes,
          Buffer.from(
            `\n@media(${media}){${selector}{color:${color}!important}}\n`,
          ),
        ]),
      );
      const env = { ...process.env };
      delete env.VECTOR_REVIEW_CAPTURE;
      delete env.VECTOR_PROOF_CAPTURE;
      delete env.VECTOR_BASELINE_PROOF;
      delete env.VECTOR_PROOF_GROUP;
      const execution = await new Promise((resolveRun, reject) => {
        const child = spawn(process.execPath, ["tests/e2e/ui-runtime.mjs"], {
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let log = "";
        child.stdout.on("data", (bytes) => (log += bytes));
        child.stderr.on("data", (bytes) => (log += bytes));
        child.on("error", reject);
        child.on("close", (code) => resolveRun({ code, log }));
      });
      await writeFile(
        resolve(directory, `${name}-${width}.log`),
        execution.log,
      );
      const failureCapture = `${name}-${width}-failure.png`;
      await copyFile(
        resolve(verificationDirectory, "ui-runtime-failure.png"),
        resolve(directory, failureCapture),
      );
      await writeFile(resolve(assets, target.name), target.bytes);
      assert.notEqual(
        execution.code,
        0,
        `${name} ${width}: ordinary ui-runtime rejects low contrast`,
      );
      assert.match(
        execution.log,
        new RegExp(`${width} ${assertion}: contrast [0-9.]+ < 4\\.5`),
        `${name} ${width}: failure is the expected computed contrast assertion`,
      );
      assert.doesNotMatch(execution.log, /SQLITE_BUSY|Timeout .*exceeded/);
      results.push({
        name,
        width,
        selector,
        color,
        command: "node tests/e2e/ui-runtime.mjs",
        captureFlag: "unset",
        code: execution.code,
        failureCapture,
        failureCaptureSha256: hash(
          await readFile(resolve(directory, failureCapture)),
        ),
        restoredSha256: hash(await readFile(resolve(assets, target.name))),
      });
      await writeFile(
        resolve(directory, "results.json"),
        JSON.stringify({ before, results }, null, 2),
      );
      console.info(
        `${name} ${width}: ordinary ui-runtime failed specifically at contrast; stylesheet restored`,
      );
    }
} finally {
  for (const file of originals)
    await writeFile(resolve(assets, file.name), file.bytes);
  const after = Object.fromEntries(
    await Promise.all(
      originals.map(async (file) => [
        file.name,
        hash(await readFile(resolve(assets, file.name))),
      ]),
    ),
  );
  assert.deepEqual(
    after,
    before,
    "every built stylesheet restored byte-for-byte",
  );
  await writeFile(
    resolve(directory, "results.json"),
    JSON.stringify(
      { before, after, passed: results.length === 6, results },
      null,
      2,
    ),
  );
}
