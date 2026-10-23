import { env } from "cloudflare:workers";
import { expect } from "vitest";
import type { ReactionProjection } from "../../src/core/features/reactions/schema";
import { collaborationFixture, count } from "./collaboration-fixture";

async function json<T>(response: Response, status = 200) {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json() as Promise<T>;
}

/** Public native doors only; the enclosing collaboration case owns registration. */
export async function exerciseReactions(existing?: {
  f: Awaited<ReturnType<typeof collaborationFixture>>;
  issue: { id: string; identifier: string };
  commentId: string;
}) {
  const f = existing?.f ?? await collaborationFixture();
  const issue = existing?.issue ?? await f.create({ title: "synthetic-vector-1", description: "synthetic-vector-2" });
  const other = await f.create({ title: "synthetic-vector-3" });
  const teamName = "synthetic-vector-4";
  const outside = (await f.mutate("/settings/teams", "POST", {
    name: teamName, identifierPrefix: "REACT",
  })).teams.find((team) => team.name === teamName)!;
  const hidden = await f.create({ title: "synthetic-vector-5", teamId: outside.id });
  const post = async (identifier: string, cookie: string, body: string) =>
    (await json<{ id: string }>(await f.any(cookie, `/issues/${identifier}/comments`, "POST", { body }), 201)).id;
  const comment = await post(issue.identifier, f.bobCookie, "synthetic-vector-6");
  const deletedComment = existing?.commentId ?? await post(issue.identifier, f.cookie, "synthetic-vector-7");
  const foreignComment = await post(other.identifier, f.cookie, "synthetic-vector-8");
  const path = `/issues/${issue.identifier}/reactions`;
  const read = async (cookie = f.cookie, identifier = issue.identifier) =>
    json<ReactionProjection>(await f.any(cookie, `/issues/${identifier}/reactions`));
  const react = async (cookie: string, method: "PUT" | "DELETE", subjectId = "description", emoji = "👍🏽") =>
    json<ReactionProjection>(await f.any(cookie, path, method, { subjectId, emoji }));
  const reaction = (projection: ReactionProjection, subjectId = "description", emoji = "👍🏽") =>
    projection.reactions.find((item) => item.subjectId === subjectId && item.emoji === emoji);
  const settings = await json<{ operators: { id: string; name: string }[] }>(await f.call("/settings"));
  const names = Object.fromEntries(settings.operators.map((person) => [person.id, person.name]));
  const effects = async () => Promise.all([
    count("notifications"), count("notification_candidates"), count("notification_deliveries"),
    count("rer_mail_development_outbox"), count("issue_activity"),
    env.DB.prepare("SELECT version,updated_at FROM issues WHERE id=?").bind(issue.id).first(),
  ]);
  const before = await effects();
  expect(await read()).toEqual({ canReact: true, reactions: [] });

  const first = await react(f.bobCookie, "PUT");
  expect(reaction(first)).toEqual({
    subjectId: "description", emoji: "👍🏽", count: 1, reacted: true,
    people: [{ id: f.bob, name: names[f.bob] }],
  });
  expect(await react(f.bobCookie, "PUT")).toEqual(first);
  const both = await react(f.caraCookie, "PUT");
  expect(reaction(both)).toMatchObject({ count: 2, reacted: true });
  expect(reaction(both)!.people).toEqual(expect.arrayContaining([
    { id: f.bob, name: names[f.bob] }, { id: f.cara, name: names[f.cara] },
  ]));
  // Another session observes count and participants, with its own toggle state.
  expect(reaction(await read(f.bobCookie))).toMatchObject({ count: 2, reacted: true });
  expect(reaction(await read())).toMatchObject({ count: 2, reacted: false });
  expect(reaction(await react(f.bobCookie, "DELETE"))).toMatchObject({
    count: 1, reacted: false, people: [{ id: f.cara, name: names[f.cara] }],
  });
  const removed = await read(f.bobCookie);
  expect(await react(f.bobCookie, "DELETE")).toEqual(removed);
  await react(f.bobCookie, "PUT");

  // Real Unicode sequences include family joins, regional flags and keycaps.
  expect(reaction(await react(f.bobCookie, "PUT", comment, "👨‍👩‍👧‍👦"), comment, "👨‍👩‍👧‍👦"))
    .toMatchObject({ count: 1, reacted: true });
  await react(f.cookie, "PUT", comment, "🇦🇺");
  await react(f.cookie, "PUT", "description", "1️⃣");
  await react(f.cookie, "DELETE", "description", "1️⃣");
  await react(f.cookie, "PUT", deletedComment, "✅");
  for (const body of [
    { subjectId: "description", emoji: "synthetic-vector-9" },
    { subjectId: "description", emoji: "👍👍" },
    { subjectId: "description", emoji: "🥑🏻" },
    { subjectId: "description", emoji: "👍\n" },
    { subjectId: "description", emoji: "👍", operatorId: f.cara },
    { subjectId: "synthetic-vector-10", emoji: "👍" },
  ]) expect((await f.any(f.bobCookie, path, "PUT", body)).status).toBe(400);
  for (const method of ["PUT", "DELETE"] as const)
    for (const subjectId of [foreignComment, "00000000000000000000000000"])
      expect((await f.any(f.bobCookie, path, method, { subjectId, emoji: "👍" })).status).toBe(404);

  // Admins can react. A real role assignment immediately makes the same
  // session a read-only Guest, restricted to the named team's work.
  expect((await f.call(`/settings/operators/${f.cara}/role`, "PATCH", { role: "admin" })).status).toBe(200);
  await react(f.caraCookie, "PUT", "description", "🇦🇺");
  await react(f.caraCookie, "DELETE", "description", "🇦🇺");
  await json<ReactionProjection>(await f.call(`/issues/${hidden.identifier}/reactions`, "PUT", { subjectId: "description", emoji: "🔒" }));
  expect((await f.call(`/settings/operators/${f.cara}/role`, "PATCH", {
    role: "guest", teamIds: [f.initial.teams[0].id],
  })).status).toBe(200);
  const guestRead = await read(f.caraCookie);
  expect(guestRead.canReact).toBe(false);
  expect(reaction(guestRead)).toMatchObject({ count: 2, reacted: true });
  expect(guestRead.reactions.some((item) => item.emoji === "🔒")).toBe(false);
  for (const method of ["PUT", "DELETE"] as const) {
    expect((await f.any(f.caraCookie, path, method, { subjectId: "description", emoji: "👍🏽" })).status).toBe(403);
    expect((await f.any(f.caraCookie, `/issues/${hidden.identifier}/reactions`, method, { subjectId: "description", emoji: "🔒" })).status).toBe(404);
  }
  expect((await f.any(f.caraCookie, `/issues/${hidden.identifier}/reactions`)).status).toBe(404);
  expect(await effects()).toEqual(before);

  // Soft deletion erases the reaction subject and refuses subsequent toggles.
  expect((await f.call(`/issues/${issue.identifier}/comments/${deletedComment}`, "DELETE")).status).toBe(200);
  expect((await read()).reactions.some((item) => item.subjectId === deletedComment)).toBe(false);
  expect(await count("issue_reactions", "subject_id=?", [deletedComment])).toBe(0);
  for (const method of ["PUT", "DELETE"] as const)
    expect((await f.any(f.bobCookie, path, method, { subjectId: deletedComment, emoji: "✅" })).status).toBe(404);

  // Removal uses the same current-name tombstone as comments; reactions never
  // retain a separate copy of a person's former name.
  expect((await f.call(`/settings/operators/${f.bob}`, "DELETE")).status).toBe(200);
  const discussion = await json<{ comments: { id: string; actor: string }[] }>(await f.call(`/issues/${issue.identifier}/discussion`));
  const anonymous = discussion.comments.find((item) => item.id === comment)!.actor;
  const afterRemoval = await read();
  expect(anonymous).not.toBe(names[f.bob]);
  expect(reaction(afterRemoval)).toMatchObject({ count: 2 });
  expect(reaction(afterRemoval)!.people.find((person) => person.id === f.bob)?.name).toBe(anonymous);
  expect(reaction(afterRemoval, comment, "👨‍👩‍👧‍👦")!.people).toEqual([{ id: f.bob, name: anonymous }]);
  expect(JSON.stringify(afterRemoval)).not.toContain(names[f.bob]);
  expect((await f.any(f.bobCookie, path)).status).toBe(401);
  expect((await f.any(f.bobCookie, path, "PUT", { subjectId: "description", emoji: "👍" })).status).toBe(401);
  expect((await f.call(`/settings/teams/${f.initial.teams[0].id}/members/${f.cara}`, "DELETE")).status).toBe(200);
  expect((await f.any(f.caraCookie, path)).status).toBe(404);
}
