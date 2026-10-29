import { referenceScenario } from './reference-scenario';
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { setupIntegrations } from "./integration-fixture";
import { heldBody } from "./removal-fixture";
import { createServerApp } from "../../src/core/app/server";
import { signIn, request } from "./base-auth-fixture";
import { bindings, origin } from "./base-auth-fixture";
import { parseTasks } from "../../src/core/features/description-history/tasks";

type Issue = { id: string; identifier: string; description: string; version: number; activity: { nextValue: unknown }[] };
type History = { revisions: { id: string; description: string; actor: string | null; version: number | null }[] };
async function receipt<T>(response: Response, status = 200): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json() as Promise<T>;
}

async function nativeJourney() {
  const f = await collaborationFixture();
  const source = "- [ ] Release\n  - [ ] Docs\n- [ ] Verify\n\n```md\n- [ ] literal\n```";
  const issue = await f.create({ description: source });
  const path = `/issues/${issue.identifier}`;
  const history = await receipt<History>(await f.call(path + "/description-history"));
  expect(history.revisions.map(row => row.description)).toEqual([source]);
  expect(history.revisions[0].actor).toBe(await env.DB.prepare("SELECT name FROM operators WHERE id=?").bind(f.owner).first<string>("name"));
  expect(parseTasks(source).map(row => row.text)).toEqual(["Release\n  - [ ] Docs", "Docs", "Verify"]);
  const click = (index: number, text: string, expectedVersion = issue.version) =>
    f.call(path + "/checklist", "POST", { expectedVersion, index, text, checked: true });
  const first = await receipt<Issue>(await click(2, "Verify"));
  expect(first.description).toBe(source.replace("[ ] Verify", "[x] Verify"));
  // A second stale click can merge with the first item's independent change.
  const second = await receipt<Issue>(await click(1, "Docs"));
  expect(second.description).toBe(first.description.replace("[ ] Docs", "[x] Docs"));
  expect(second.activity.some(row => JSON.stringify(row.nextValue).includes('"checklist"'))).toBe(true);
  const edited = await receipt<Issue>(await f.call(path, "PATCH", { expectedVersion: second.version, description: second.description.replace("Docs", "Guides") }));
  expect((await click(1, "Docs")).status).toBe(409);
  expect((await f.call(path + "/description-restore", "POST", { expectedVersion: issue.version, revisionId: history.revisions[0].id })).status).toBe(409);
  const restored = await receipt<Issue>(await f.call(path + "/description-restore", "POST", { expectedVersion: edited.version, revisionId: history.revisions[0].id }));
  expect(restored.description).toBe(source);
  const after = await receipt<History>(await f.call(path + "/description-history"));
  expect(after.revisions.map(row => row.description)).toEqual([source, first.description, second.description, edited.description, source]);
  expect(after.revisions.at(-1)?.version).toBe(restored.version);
  expect(restored.activity.some(row => JSON.stringify(row.nextValue).includes('"descriptionRestore"'))).toBe(true);
  const repeated = await receipt<Issue>(await f.call(path + "/description-restore", "POST", { expectedVersion: restored.version, revisionId: history.revisions[0].id }));
  const repeatedHistory = await receipt<History>(await f.call(path + "/description-history"));
  expect(repeatedHistory.revisions).toHaveLength(after.revisions.length + 1);
  expect(repeatedHistory.revisions.at(-1)?.version).toBe(repeated.version);

  const body = "> 1. [ ] **Review**\n> 2. [ ] Child\n\n    - [ ] code";
  const comment = await receipt<{ id: string }>(await f.call(path + "/comments", "POST", { body }), 201);
  const route = `${path}/comments/${comment.id}/checklist`;
  const task = parseTasks(body)[1];
  const input = { expectedBody: body, expectedVersion: 0, index: task.index, text: task.text, checked: true };
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT IN ('integration_token_usage','access_rate_limits') ORDER BY name").all<{ name: string }>()).results;
  const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async ({ name }) => [name,
    (await env.DB.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all()).results.map(row => JSON.stringify(row)).sort()])));
  const beforeRefusal = await snapshot();
  const peerSession = await receipt<{ role: string }>(await f.any(f.bobCookie, "/session"));
  expect(peerSession.role).toBe("member");
  expect((await f.any(f.bobCookie, route, "POST", input)).status).toBe(403);
  expect(await snapshot()).toEqual(beforeRefusal);
  const bobToken = await receipt<{ token: string }>(await f.any(f.bobCookie, "/settings/integrations/tokens", "POST", { name: "synthetic-vector-2501", scopes: ["comments:write"] }), 201);
  const afterMint = await snapshot();
  const refused = await createServerApp().request(origin + "/api/v1" + route, {
    method: "POST", headers: { Authorization: "Bearer " + bobToken.token, Origin: origin, "content-type": "application/json" }, body: JSON.stringify(input),
  }, bindings);
  expect(refused.status, await refused.clone().text()).toBe(403);
  expect(await snapshot()).toEqual(afterMint);
  const discussion = await receipt<{ comments: { id: string; body: string; canEdit: number; version: number }[] }>(await f.call(path + "/discussion"));
  expect(Boolean(discussion.comments.find(row => row.id === comment.id)?.canEdit)).toBe(true);
  expect(discussion.comments.find(row => row.id === comment.id)?.version).toBe(0);
  const peerView = await receipt<typeof discussion>(await f.any(f.bobCookie, path + "/discussion"));
  expect(Boolean(peerView.comments.find(row => row.id === comment.id)?.canEdit)).toBe(false);
  // A genuine second sign-in, rather than reusing the first session's cookie.
  const secondSession = await signIn();
  expect(secondSession).not.toBe(f.cookie);
  await receipt(await f.call(route, "POST", input));
  await receipt(await f.any(secondSession, route, "POST", { ...input, index: 0, text: parseTasks(body)[0].text }));
  const saved = body.replace("[ ] Child", "[x] Child").replace("[ ] **Review**", "[x] **Review**");
  const read = await receipt<typeof discussion>(await f.call(path + "/discussion"));
  expect(read.comments.find(row => row.id === comment.id)).toMatchObject({ body: saved, version: 2 });
  const revisions = (await env.DB.prepare("SELECT actor_operator_id actor,next_value_json value FROM issue_activity WHERE issue_id=? AND kind='comment.edited' ORDER BY rowid").bind(issue.id).all<{ actor: string; value: string }>()).results;
  expect(revisions.map(row => ({ actor: row.actor, ...JSON.parse(row.value) }))).toEqual([
    { actor: f.owner, id: comment.id, revision: 1, checklist: { index: 1, text: task.text, checked: true } },
    { actor: f.owner, id: comment.id, revision: 2, checklist: { index: 0, text: parseTasks(body)[0].text, checked: true } },
  ]);
  expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE subject_id=? AND action='comment.edited'").bind(comment.id).first<number>("n")).toBe(2);
  const unchanged = await snapshot();
  await receipt(await f.call(route, "POST", input));
  expect(await snapshot()).toEqual(unchanged);
  // A changed target keeps its 409 contract and exposes the current text.
  await receipt(await f.call(`${path}/comments/${comment.id}`, "PATCH", { body: saved.replace("Child", "Guides") }));
  const changedTarget = await snapshot();
  const conflict = await receipt<{ comment: { id: string; body: string; version: number } }>(await f.call(route, "POST", input), 409);
  expect(conflict.comment).toEqual({ id: comment.id, body: saved.replace("Child", "Guides"), version: 3 });
  expect(await snapshot()).toEqual(changedTarget);
  const finalIssue = await receipt<Issue & { status: { id: string } }>(await f.call(path));
  expect(finalIssue.status.id).toBe(issue.status.id);
  expect(finalIssue.description).toBe(source);
  expect(finalIssue.version).toBe(repeated.version);
  expect((await receipt<History>(await f.call(path + "/description-history"))).revisions).toEqual(repeatedHistory.revisions);
  // Nested checkboxes are independent items even though their source spans overlap.
  const nestedBody = "- [ ] Release\n  - [ ] Review draft";
  const nested = await receipt<{ id: string }>(await f.call(path + "/comments", "POST", { body: nestedBody }), 201);
  const nestedRoute = `${path}/comments/${nested.id}/checklist`;
  const nestedTasks = parseTasks(nestedBody);
  for (const [cookie, index] of [[f.cookie, 1], [secondSession, 0]] as const) {
    await receipt(await f.any(cookie, nestedRoute, "POST", {
      expectedBody: nestedBody, expectedVersion: 0, index, text: nestedTasks[index].text, checked: true,
    }));
  }
  const nestedView = await receipt<typeof discussion>(await f.call(path + "/discussion"));
  expect(nestedView.comments.find(row => row.id === nested.id)).toMatchObject({
    body: "- [x] Release\n  - [x] Review draft", version: 2,
  });
  const nestedEdits = (await env.DB.prepare("SELECT actor_operator_id actor,next_value_json value FROM issue_activity WHERE issue_id=? AND kind='comment.edited' AND json_extract(next_value_json,'$.id')=? ORDER BY rowid").bind(issue.id, nested.id).all<{ actor: string; value: string }>()).results;
  expect(nestedEdits.map(row => ({ actor: row.actor, ...JSON.parse(row.value) }))).toEqual([
    { actor: f.owner, id: nested.id, revision: 1, checklist: { index: 1, text: nestedTasks[1].text, checked: true } },
    { actor: f.owner, id: nested.id, revision: 2, checklist: { index: 0, text: nestedTasks[0].text, checked: true } },
  ]);
  expect(await env.DB.prepare("SELECT count(*) n FROM audit_records WHERE subject_id=? AND action='comment.edited'").bind(nested.id).first<number>("n")).toBe(2);
  const nestedUnchanged = await snapshot();
  await receipt(await f.any(secondSession, nestedRoute, "POST", {
    expectedBody: nestedBody, expectedVersion: 0, index: 0, text: nestedTasks[0].text, checked: true,
  }));
  expect(await snapshot()).toEqual(nestedUnchanged);
  await receipt(await f.call(`${path}/comments/${nested.id}`, "PATCH", {
    body: "- [x] Release\n  - [x] Revised draft",
  }));
  const nestedChanged = await snapshot();
  const nestedConflict = await receipt<{ comment: { id: string; body: string; version: number } }>(await f.any(secondSession, nestedRoute, "POST", {
    expectedBody: nestedBody, expectedVersion: 0, index: 0, text: nestedTasks[0].text, checked: false,
  }), 409);
  expect(nestedConflict.comment).toEqual({ id: nested.id, body: "- [x] Release\n  - [x] Revised draft", version: 3 });
  expect(await snapshot()).toEqual(nestedChanged);
  expect((await receipt<Issue & { status: { id: string } }>(await f.call(path))).status.id).toBe(issue.status.id);
  const endingSession = await signIn(), heldConflict = heldBody();
  const pendingConflict = createServerApp().request(origin + "/api" + route, {
    method: "POST", headers: { Host: new URL(origin).host, Cookie: endingSession, Origin: origin, "content-type": "application/json" }, body: heldConflict.body,
  }, bindings);
  await Promise.race([heldConflict.reading, pendingConflict.then(response => { throw new Error("Conflict request ended before its body was read: " + response.status); })]);
  expect((await request("/auth/signout", "POST", {}, endingSession)).status).toBe(204);
  const signedOut = await snapshot();
  heldConflict.release(JSON.stringify(input));
  const deniedConflict = await pendingConflict;
  expect(deniedConflict.status).toBe(401);
  expect(await deniedConflict.text()).not.toContain("Guides");
  expect(await snapshot()).toEqual(signedOut);
  await receipt(await f.call(`${path}/comments/${comment.id}`, "DELETE"));
  const erased = await snapshot();
  expect((await f.any(secondSession, route, "POST", input)).status).toBe(404);
  expect(await snapshot()).toEqual(erased);
  await receipt(await f.call(path, "DELETE", { expectedVersion: repeated.version, confirmed: true }));
  expect(await env.DB.prepare("SELECT count(*) n FROM issue_description_revisions WHERE issue_id=?").bind(issue.id).first<number>("n")).toBe(0);
}

async function scopedJourney() {
  const f = await setupIntegrations(), source = "- [ ] Publish";
  const issue = await f.create({ description: source }), path = `/issues/${issue.identifier}`;
  const reader = await f.issueToken(["issues:read"]), writer = await f.issueToken(["issues:write"], "Description writer"), commenter = await f.issueToken(["comments:write"], "Comment writer");
  const history = await receipt<History>(await f.api(reader.token, path + "/description-history"));
  const tick = { expectedVersion: issue.version, index: 0, text: "Publish", checked: true };
  expect((await f.api(reader.token, path + "/checklist", "POST", tick)).status).toBe(401);
  expect((await f.api(writer.token, path + "/description-history")).status).toBe(401);
  const changed = await receipt<Issue>(await f.api(writer.token, path + "/checklist", "POST", tick));
  expect(changed.description).toBe("- [x] Publish");
  const restored = await receipt<Issue>(await f.api(writer.token, path + "/description-restore", "POST", { expectedVersion: changed.version, revisionId: history.revisions[0].id }));
  expect(restored.description).toBe(source);
  const comment = await receipt<{ id: string }>(await f.api(commenter.token, path + "/comments", "POST", { body: source }), 201);
  await receipt(await f.api(commenter.token, `${path}/comments/${comment.id}/checklist`, "POST", { expectedBody: source, index: 0, text: "Publish", checked: true }));
  const config = await receipt<{ tokens: { id: string; name: string }[] }>(await f.call("/settings/integrations"));
  const commenterId = config.tokens.find(token => token.name === "Comment writer")!.id;
  const heldComment = heldBody();
  const pendingComment = f.app.request(origin + "/api/v1" + `${path}/comments/${comment.id}/checklist`, {
    method: "POST", headers: { Authorization: "Bearer " + commenter.token, Origin: origin, "content-type": "application/json" }, body: heldComment.body,
  }, bindings);
  await heldComment.reading;
  await receipt(await f.call(`/settings/integrations/tokens/${commenterId}`, "DELETE"));
  const beforeRelease = (await env.DB.prepare("SELECT * FROM issue_activity WHERE issue_id=? ORDER BY rowid").bind(issue.id).all()).results;
  heldComment.release(JSON.stringify({ expectedBody: "- [x] Publish", expectedVersion: 1, index: 0, text: "Publish", checked: false }));
  expect((await pendingComment).status).toBe(401);
  expect(await env.DB.prepare("SELECT body FROM issue_comments WHERE id=?").bind(comment.id).first<string>("body")).toBe("- [x] Publish");
  expect((await env.DB.prepare("SELECT * FROM issue_activity WHERE issue_id=? ORDER BY rowid").bind(issue.id).all()).results).toEqual(beforeRelease);
  const writerId = config.tokens.find(token => token.name === "Description writer")!.id;
  const held = heldBody();
  const pending = f.app.request(origin + "/api/v1" + path + "/checklist", {
    method: "POST", headers: { Authorization: "Bearer " + writer.token, Origin: origin, "content-type": "application/json" }, body: held.body,
  }, bindings);
  await held.reading;
  await receipt(await f.call(`/settings/integrations/tokens/${writerId}`, "DELETE"));
  held.release(JSON.stringify({ ...tick, expectedVersion: restored.version }));
  expect((await pending).status).toBe(401);
  const current = await receipt<Issue>(await f.call(path));
  expect(current.description).toBe(source);
  expect(current.version).toBe(restored.version);
}

contractWith(it, "ISSUE-018 ISSUE-025 BASE-ACCESS-004", "description history and checklists preserve native and scoped authority through revision, restore and concurrent edits", async () => {
  await nativeJourney();
  await scopedJourney();
  await referenceScenario();
});
