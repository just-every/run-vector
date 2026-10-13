import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createUiRuntime } from "./ui-runtime-support.mjs";
import { signIn, openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { apiActor } from "./issue-controls-fixture.mjs";
import { boardFocus, parentFocus } from "./browse-review-focus.mjs";
import { emptyBoard, longView } from "./browse-review-layout.mjs";
import {
  pagingRestart,
  scheduledCustody,
  boardMoveAcrossPage,
  staleBoardRestart,
} from "./browse-review-paging.mjs";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
const runtime = createUiRuntime(),
  results = [],
  evidence = resolve(verificationDirectory, "browse-review");
await mkdir(evidence, { recursive: true });
for (const port of [15934, 15935])
  await new Promise((done, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(done));
  });
let browser;
const errors = [];
try {
  runtime.initialize();
  runtime.start();
  await runtime.ready();
  const { cookie } = await signIn(runtime);
  browser = await chromium.launch({ headless: true });
  const page = await openAuthenticatedPage(browser, cookie, runtime.base);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  const api = apiActor(runtime, cookie),
    opts = await api("/api/options");
  const team = opts.teams[0],
    backlog = opts.statuses.find(
      (s) => s.teamId === team.id && s.category === "backlog",
    ),
    todo = opts.statuses.find(
      (s) => s.teamId === team.id && s.category === "unstarted",
    );
  const fixture = {
    api,
    opts,
    team,
    backlog,
    todo,
    create: (title) =>
      api(
        "/api/issues",
        "POST",
        { title, teamId: team.id, statusId: backlog.id },
        201,
      ),
  };
  const context = { page, base: runtime.base, runtime, results, evidence };
  await emptyBoard(context, fixture);
  await boardFocus(context, fixture);
  await parentFocus(context, fixture);
  await longView(context, fixture);
  await pagingRestart(context, fixture);
  await boardMoveAcrossPage(context, fixture);
  await staleBoardRestart(context, fixture);
  await scheduledCustody(context, fixture);
  assert.deepEqual(errors, [], "no uncaught page errors");
  assert.ok(
    results.every(
      (row) => row.geometry.documentWidth <= row.geometry.viewportWidth,
    ),
    "every state fits the document",
  );
  await writeFile(
    resolve(evidence, "results.json"),
    JSON.stringify({ passed: true, checks: results.length, results }, null, 2),
  );
  console.info(
    `Browse review: ${results.length} audited states, zero serious/critical axe, overflow or page errors.`,
  );
} finally {
  if (browser) await browser.close();
  await runtime.stop();
}
