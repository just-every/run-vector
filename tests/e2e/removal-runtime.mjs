import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import {
  origin,
  migrate,
  start,
  stop,
  sql,
  signIn,
  api,
  heldRequest,
  rateCount,
  admitted,
  retained,
} from "./removal-runtime-support.mjs";
const evidence = resolve(
  process.env.VECTOR_REMOVAL_EVIDENCE ?? ".wrangler/removal-evidence",
);
let browser;
const pending = [];
const checks = [];
function record(check) {
  checks.push(check);
  console.log("[Operator removal] " + check);
}
try {
  await mkdir(evidence, { recursive: true });
  migrate();
  await start();
  const ownerCookie = await signIn("owner@removal.test");
  const workspace = sql("SELECT id FROM workspace_settings")[0].id,
    team = sql("SELECT id FROM teams")[0].id;
  function member(n) {
    const id = "01K000000000000000000000" + String(n).padStart(2, "0");
    const email = `member${n}@removal.test`;
    sql(
      `INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES('${id}','${workspace}','Member ${n}','${email}','2026-10-06','2026-10-06')`,
    );
    return { id, email };
  }
  const original = member(1),
    originalCookie = await signIn(original.email);
  const customFields = {
    allocations: { [original.id]: 3 },
    retainedId: original.id,
    nested: { assigneeOperatorId: original.id },
  };
  const created = await api(ownerCookie, "/issues", "POST", {
    title: "Preserve allocation evidence",
    teamId: team,
    assigneeOperatorId: original.id,
    customFields,
  });
  assert.equal(created.status, 201);
  const issue = await created.json();
  assert.equal(
    (
      await api(
        originalCookie,
        `/issues/${issue.identifier}/comments`,
        "POST",
        { body: "Retained decision context" },
      )
    ).status,
    201,
  );
  assert.equal(
    (await api(ownerCookie, "/settings/operators/" + original.id, "DELETE"))
      .status,
    200,
  );
  const detail = await api(ownerCookie, "/issues/" + issue.identifier);
  assert.equal(detail.status, 200);
  assert.deepEqual((await detail.json()).customFields, customFields);
  assert.equal(
    sql(
      "SELECT count(*) n FROM issue_activity WHERE next_value_json IS NOT NULL AND NOT json_valid(next_value_json)",
    )[0].n,
    0,
  );
  record(
    "Valid arbitrary JSON, native detail and retained discussion after removal",
  );
  for (const [index, kind] of ["comment", "edit"].entries()) {
    const m = member(index + 2),
      cookie = await signIn(m.email),
      beforeRate = rateCount(m.id);
    const req = heldRequest(
      cookie,
      "/issues/" + issue.identifier + (kind === "comment" ? "/comments" : ""),
      kind === "comment" ? "POST" : "PATCH",
      kind === "comment"
        ? '{"body":'
        : `{"expectedVersion":${(await (await api(ownerCookie, "/issues/" + issue.identifier)).json()).version},"title":`,
    );
    pending.push(req);
    await admitted(m.id, beforeRate);
    assert.equal(
      (await api(ownerCookie, "/settings/operators/" + m.id, "DELETE")).status,
      200,
    );
    const before = retained();
    req.release('"Write after revocation"}');
    assert.equal((await req.response).status, 401);
    assert.deepEqual(retained(), before);
    record(`Real socket streamed ${kind} denied after successful removal`);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: ownerCookie.split("=")[0],
      value: ownerCookie.split("=")[1],
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto(origin + "/app/issues/" + issue.identifier);
    await page
      .getByRole("heading", {
        name: "Preserve allocation evidence",
        exact: true,
      })
      .waitFor();
    await page
      .getByText("Retained decision context", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page
      .getByPlaceholder("Write a comment…")
      .fill(`Active operator at ${width}`);
    const [posted] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url() ===
            origin + "/api/issues/" + issue.identifier + "/comments" &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Add comment", exact: true }).click(),
    ]);
    assert.equal(posted.status(), 201);
    await page
      .locator(".comment-entry .comment-body")
      .getByText(`Active operator at ${width}`, { exact: true })
      .waitFor();
    await page.getByText("History", { exact: true }).click();
    await page.screenshot({
      path: resolve(evidence, `retained-issue-${width}.jpg`),
      type: "jpeg",
      quality: 85,
      fullPage: true,
    });
    const uiMember = member(width === 1440 ? 10 : 11),
      uiCookie = await signIn(uiMember.email);
    await page.goto(origin + "/app/settings");
    await page
      .getByRole("heading", { name: "Settings", exact: true })
      .waitFor();
    await page
      .getByRole("button", {
        name: `Remove Member ${width === 1440 ? 10 : 11}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    await page
      .getByText("Operator removed. Their sessions are revoked.", {
        exact: true,
      })
      .waitFor();
    assert.equal((await api(uiCookie, "/session")).status, 401);
    await page
      .getByRole("button", {
        name: "Remove Workspace owner",
        exact: true,
        disabled: true,
      })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Remove Workspace owner", exact: true })
        .isDisabled(),
      true,
    );
    await page.screenshot({
      path: resolve(evidence, `retained-settings-${width}.jpg`),
      type: "jpeg",
      quality: 85,
      fullPage: true,
    });
  }
  const beforeRestart = retained();
  await stop();
  await start();
  const persisted = await api(ownerCookie, "/issues/" + issue.identifier);
  assert.equal(persisted.status, 200);
  assert.deepEqual((await persisted.json()).customFields, customFields);
  assert.deepEqual(retained(), beforeRestart);
  assert.equal((await api(originalCookie, "/session")).status, 401);
  assert.deepEqual(sql("PRAGMA foreign_key_check"), []);
  assert.deepEqual(errors, []);
  record(
    "1440/390 native UI, private session persistence and retained D1 history across restart",
  );
  await writeFile(
    resolve(evidence, "manifest.json"),
    JSON.stringify(
      {
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        at: new Date().toISOString(),
        passed: true,
        checks,
        captures: [1440, 390].flatMap((width) => [
          `retained-issue-${width}.jpg`,
          `retained-settings-${width}.jpg`,
        ]),
        scope:
          "Local emitted Worker, real D1/R2 bindings and synthetic native local-outbox identities; no provider or deployed acceptance.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  for (const req of pending) req.abort();
  if (browser) await browser.close();
  await stop();
}
