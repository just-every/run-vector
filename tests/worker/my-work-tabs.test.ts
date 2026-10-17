import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture } from "./collaboration-fixture";
import { listIssues } from "../../src/core/features/issues/list";
import { issueListQuerySchema } from "../../src/core/features/issues/list-schema";
import { myActivity } from "../../src/core/features/my-work/activity";

contractWith(
  it,
  "WORK-004 OPS-001",
  "Created, Subscribed and Activity follow the member and drop issues they can no longer see",
  async () => {
    const f = await collaborationFixture();
    const team = f.initial.teams[0].id;
    const create = async (cookie: string, title: string) => {
      const response = await f.any(cookie, "/issues", "POST", { title, teamId: team });
      expect(response.status, await response.clone().text()).toBe(201);
      return (await response.json()) as { identifier: string };
    };
    const mine = [await create(f.bobCookie, "Bob first"), await create(f.bobCookie, "Bob second")];
    const followed = await create(f.caraCookie, "Cara asks Bob to watch");
    const commented = await create(f.caraCookie, "Cara wants a comment");
    expect((await f.any(f.bobCookie, `/issues/${followed.identifier}/subscription`, "PATCH", { following: true })).status).toBe(200);
    expect((await f.any(f.bobCookie, `/issues/${commented.identifier}/comments`, "POST", { body: "Bob's reply" })).status).toBe(201);
    const list = async (scope: string, cookie = f.bobCookie) =>
      ((await f.data(cookie, `/issues?scope=${scope}`)).issues as { identifier: string }[]).map((issue) => issue.identifier);

    // Created lists exactly the member's own issues, newest first, for the viewer.
    expect(await list("created")).toEqual([mine[1]!.identifier, mine[0]!.identifier]);
    expect(await list("created", f.caraCookie)).toEqual([commented.identifier, followed.identifier]);
    // Subscribed is every issue the member follows: creations, explicit follows and comments.
    expect(new Set(await list("subscribed"))).toEqual(new Set([...mine, followed, commented].map((issue) => issue.identifier)));
    expect((await f.any(f.bobCookie, `/issues/${followed.identifier}/subscription`, "PATCH", { following: false })).status).toBe(200);
    expect(await list("subscribed")).not.toContain(followed.identifier);
    // Scoped tabs keep the issue-view filters.
    expect(await f.data(f.bobCookie, `/issues?scope=created&q=second`)).toMatchObject({ total: 1 });

    const activity = (await f.data(f.bobCookie, "/my-work/activity")).entries as { kind: string; issue: { identifier: string }; comment: string | null }[];
    expect(activity[0]).toMatchObject({ kind: "comment.created", issue: { identifier: commented.identifier }, comment: "Bob's reply" });
    expect(activity.filter((entry) => entry.kind === "issue.created").map((entry) => entry.issue.identifier)).toEqual([mine[1]!.identifier, mine[0]!.identifier]);
    expect(activity.every((entry) => [...mine, commented].some((issue) => issue.identifier === entry.issue.identifier))).toBe(true);

    // Access narrows every tab: a member outside the issues' workspace sees none of them.
    const workspace = "01J00000000000000000000774";
    await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Elsewhere','UTC','now','now')").bind(workspace).run();
    await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?").bind(workspace, f.bob).run();
    // The request layer refuses that unconfigured workspace outright, so read the
    // tabs' own projections directly.
    for (const scope of ["created", "subscribed"] as const)
      expect((await listIssues(env.DB, f.bob, issueListQuerySchema.parse({ scope }))).issues).toEqual([]);
    expect((await myActivity(env.DB, f.bob)).entries).toEqual([]);
  },
);
