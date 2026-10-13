import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
import { changeComment } from "../../src/core/features/discussion/repository";
contractWith(
  it,
  "NOTIFY-001 NOTIFY-002 NOTIFY-003 NOTIFY-004 NOTIFY-006 ISSUE-006 ISSUE-008 ISSUE-013",
  "native assignment, selected mentions, committed edit deltas and comment follows share one event without changing collaboration versions",
  async () => {
    const f = await collaborationFixture(),
      b = mentionToken({ id: f.bob, name: "Bob" }),
      c = mentionToken({ id: f.cara, name: "Cara" });
    const issue = await f.create({
      title: "Full notification title",
      description: `${b} ${b}`,
      assigneeOperatorId: f.bob,
    });
    let inbox = await f.data(f.bobCookie, "/notifications");
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0].causes.sort()).toEqual(["assignment", "mention"]);
    expect(inbox.unreadCount).toBe(1);
    expect(await count("notification_deliveries")).toBe(1);
    expect(await count("notification_development_mail")).toBe(1);
    expect(await f.data(f.cookie, "/notifications/count")).toEqual({
      unreadCount: 0,
    });
    expect(await count("issue_followers", "issue_id=?", [issue.id])).toBe(2);
    expect(
      (
        await f.any(
          f.caraCookie,
          `/issues/${issue.identifier}/subscription`,
          "PATCH",
          { following: true },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await f.any(
          f.caraCookie,
          `/issues/${issue.identifier}/subscription`,
          "PATCH",
          { following: true },
        )
      ).status,
    ).toBe(200);
    expect(
      (await f.data(f.cookie, `/issues/${issue.identifier}`)).version,
    ).toBe(issue.version);
    let res = await f.call(`/issues/${issue.identifier}/comments`, "POST", {
      body: `Comment private sentinel ${b}`,
    });
    expect(res.status).toBe(201);
    const comment = (await res.json()) as { id: string };
    inbox = await f.data(f.bobCookie, "/notifications");
    expect(inbox.items).toHaveLength(2);
    expect(inbox.items[0].causes.sort()).toEqual(["comment", "mention"]);
    expect(
      (await f.data(f.caraCookie, "/notifications")).items[0].causes,
    ).toEqual(["comment"]);
    expect(await count("notification_deliveries")).toBe(2);
    expect(
      (await f.data(f.cookie, `/issues/${issue.identifier}`)).version,
    ).toBe(issue.version);
    await f.call(
      `/issues/${issue.identifier}/comments/${comment.id}`,
      "PATCH",
      { body: `${b} ${c}` },
    );
    expect(await count("notifications", "recipient_id=?", [f.cara])).toBe(2);
    await f.call(
      `/issues/${issue.identifier}/comments/${comment.id}`,
      "PATCH",
      { body: c },
    );
    expect(await count("notifications", "recipient_id=?", [f.bob])).toBe(2);
    await f.call(
      `/issues/${issue.identifier}/comments/${comment.id}`,
      "PATCH",
      { body: `${b} ${c}` },
    );
    expect(await count("notifications", "recipient_id=?", [f.bob])).toBe(3);
    // Concurrent edits compare stored mention membership within their source batch.
    await f.call(
      `/issues/${issue.identifier}/comments/${comment.id}`,
      "PATCH",
      { body: "None" },
    );
    await Promise.all([
      changeComment(env.DB, issue, comment.id, f.owner, b),
      changeComment(env.DB, issue, comment.id, f.owner, b),
    ]);
    expect(await count("notifications", "recipient_id=?", [f.bob])).toBe(4);
    const priorFollowers = await count("issue_followers", "issue_id=?", [
      issue.id,
    ]);
    await f.call(
      `/issues/${issue.identifier}/comments/${comment.id}`,
      "DELETE",
    );
    expect(await count("issue_mentions", "comment_id=?", [comment.id])).toBe(0);
    expect(await count("issue_followers", "issue_id=?", [issue.id])).toBe(
      priorFollowers,
    );
    const before = await count("notifications");
    expect(
      (
        await f.call(`/issues/${issue.identifier}`, "PATCH", {
          expectedVersion: issue.version - 1,
          description: c,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call(`/issues/${issue.identifier}`, "PATCH", {
          expectedVersion: issue.version,
          description: c,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await f.call(`/issues/${issue.identifier}`, "PATCH", {
          expectedVersion: issue.version,
          description: b,
        })
      ).status,
    ).toBe(409);
    expect(await count("notifications")).toBe(before! + 1);
    expect(await count("notification_candidates")).toBe(0);
  },
);
contractWith(
  it,
  "NOTIFY-003 NOTIFY-004 NOTIFY-006 BASE-ACCESS-002 BASE-ACCESS-004",
  "own inbox paging/read, per-cause mutes and email opt-out do not expose or modify another operator",
  async () => {
    const f = await collaborationFixture(),
      b = mentionToken({ id: f.bob, name: "Bob" });
    expect(
      (
        await f.any(f.bobCookie, "/settings/notifications", "PATCH", {
          mutedKinds: ["assignment"],
        })
      ).status,
    ).toBe(200);
    const first = await f.create({ assigneeOperatorId: f.bob, description: b });
    let items = (await f.data(f.bobCookie, "/notifications")).items;
    expect(items[0].causes).toEqual(["mention"]);
    expect(await count("notification_deliveries")).toBe(1);
    expect(
      (await f.any(f.caraCookie, `/notifications/${items[0].id}/read`, "POST"))
        .status,
    ).toBe(404);
    expect(
      (
        await f.any(f.bobCookie, "/settings/notifications", "PATCH", {
          operatorId: f.cara,
          emailEnabled: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.any(f.bobCookie, "/settings/notifications", "PATCH", {
          emailEnabled: false,
        })
      ).status,
    ).toBe(200);
    await f.create({ description: b });
    expect(await count("notification_deliveries")).toBe(1);
    const page = await f.data(f.bobCookie, "/notifications?limit=1");
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    const second = await f.data(
      f.bobCookie,
      "/notifications?limit=1&cursor=" + encodeURIComponent(page.nextCursor),
    );
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(page.items[0].id);
    expect(
      (
        await f.any(
          f.bobCookie,
          `/notifications/${page.items[0].id}/read`,
          "POST",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await f.any(
          f.bobCookie,
          `/notifications/${page.items[0].id}/read`,
          "POST",
        )
      ).status,
    ).toBe(200);
    expect(
      (await f.data(f.bobCookie, "/notifications/count")).unreadCount,
    ).toBe(1);
    await f.any(f.bobCookie, "/notifications/read-all", "POST");
    expect(
      (await f.data(f.bobCookie, "/notifications/count")).unreadCount,
    ).toBe(0);
    await f.any(
      f.bobCookie,
      `/issues/${first.identifier}/subscription`,
      "PATCH",
      { muted: true },
    );
    const before = await count("notifications");
    await f.call(`/issues/${first.identifier}/comments`, "POST", { body: b });
    expect(await count("notifications")).toBe(before);
    expect(
      await f.data(f.bobCookie, `/issues/${first.identifier}/subscription`),
    ).toEqual({ following: true, muted: true });
    await f.any(
      f.bobCookie,
      `/issues/${first.identifier}/subscription`,
      "PATCH",
      { muted: false },
    );
    expect(await count("notifications")).toBe(before);
    for (const path of [
      "/notifications",
      "/notifications/count",
      "/settings/notifications",
      "/mentions/options",
      `/issues/${first.identifier}/subscription`,
    ])
      expect((await f.any("", path)).status).toBe(401);
    expect((await f.any(f.bobCookie, "/notifications?limit=51")).status).toBe(
      400,
    );
    expect(
      (await f.any(f.bobCookie, "/notifications?cursor=invalid")).status,
    ).toBe(400);
  },
);
