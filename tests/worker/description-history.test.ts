import { referenceScenario } from './reference-scenario';
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { setupIntegrations } from "./integration-fixture";
import { heldBody } from "./removal-fixture";
import { createServerApp } from "../../src/core/app/server";
import { signIn } from "./base-auth-fixture";
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
  const snapshot = async () => Promise.all(["issues", "issue_comments", "issue_activity", "audit_records", "issue_description_revisions", "issue_mentions", "issue_reference_subjects", "notifications", "notification_events"]
    .map(async table => [table, (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results]));
  const beforeRefusal = await snapshot();
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
  await receipt(await f.call(path, "DELETE", { expectedVersion: repeated.version, confirmed: true }));
  expect(await env.DB.prepare("SELECT count(*) n FROM issue_description_revisions WHERE issue_id=?").bind(issue.id).first<number>("n")).toBe(0);
}

async function scopedJourney() {
  const f = await setupIntegrations(), source = "- [ ] Publish";
  const issue = await f.create({ description: source }), path = `/issues/${issue.identifier}`;
  const reader = await f.issueToken(["issues:read"]), writer = await f.issueToken(["issues:write"], "Description writer"), commenter = await f.issueToken(["comments:write"]);
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
