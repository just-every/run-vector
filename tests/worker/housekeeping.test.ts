import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { readArchive } from "@runeditrun/rer/modules/portability";
import { contractWith } from "../contract-tags";
import { bindings, request } from "./base-auth-fixture";
import { collaborationFixture, count } from "./collaboration-fixture";
import { scheduled } from "../../src/core/app/scheduled";
import type { InboxPage } from "../../src/core/features/notifications/schema";

const tick = (at: Date) => scheduled({ scheduledTime: at.getTime() }, bindings);
// A fixed clock: synthetic history is aged against the same instant every scheduled run uses.
const now = new Date();
// Synthetic history: move an issue's last activity (or its closing) into the past.
async function age(id: string, days: number, closed = false) {
  const at = new Date(now.getTime() - days * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE issues SET updated_at=?,created_at=?${closed ? ",completed_at=?" : ""} WHERE id=?`)
      .bind(...(closed ? [at, at, at, id] : [at, at, id])),
    env.DB.prepare("UPDATE issue_activity SET created_at=?,updated_at=? WHERE issue_id=?").bind(at, at, id),
  ]);
}

contractWith(
  it,
  "AUTO-003",
  "a scheduled run closes a 30-day stale issue and archives a 90-day completed one, each with a reason entry readers see and one follower notification like a status change, as previewed",
  async () => {
    const f = await collaborationFixture(), team = f.initial.teams[0];
    const status = (category: string) => team.statuses.find((s) => s.category === category)!.id;
    const bug = (await f.mutate("/settings/labels", "POST", { name: "Bug", color: "#d64545" })).labels.find((l) => l.name === "Bug")!;
    const stale = await f.create({ title: "Stale vendor follow-up", statusId: status("backlog") });
    const staleBug = await f.create({ title: "Stale checkout crash", statusId: status("backlog"), labelIds: [bug.id] });
    const fresh = await f.create({ title: "Fresh pricing question", statusId: status("backlog") });
    const done = await f.create({ title: "Shipped invoice export", statusId: status("completed") });
    // Bob follows both automated issues and one an operator cancels by hand; Cara reads without following.
    const manual = await f.create({ title: "Manually canceled vendor call", statusId: status("backlog") });
    for (const issue of [stale, done, manual])
      expect((await f.any(f.bobCookie, `/issues/${issue.identifier}/subscription`, "PATCH", { following: true })).status).toBe(200);
    expect((await f.call("/issues/" + manual.identifier, "PATCH", { expectedVersion: manual.version, statusId: status("canceled") })).status).toBe(200);
    await age(stale.id, 31); await age(staleBug.id, 31); await age(done.id, 91, true);

    const path = `/settings/teams/${team.id}/housekeeping`;
    const rule = { closeAfterDays: 30, archiveAfterDays: 90, exemptBugs: true };
    expect((await f.call(path, "PUT", { ...rule, closeAfterDays: 0 })).status).toBe(400);
    expect((await f.mutate(path, "PUT", rule)).housekeeping).toEqual([{ teamId: team.id, ...rule }]);
    const preview = await (await f.call(path + "/preview", "POST", rule)).json() as { close: { identifier: string }[]; archive: { identifier: string }[] };
    expect(preview.close.map((i) => i.identifier)).toEqual([stale.identifier]);
    expect(preview.archive.map((i) => i.identifier)).toEqual([done.identifier]);
    const unexempt = await (await f.call(path + "/preview", "POST", { ...rule, exemptBugs: false })).json() as typeof preview;
    expect(unexempt.close.map((i) => i.identifier).sort()).toEqual([stale.identifier, staleBug.identifier].sort());

    await tick(now);
    await tick(now);
    type Read = { status: { id: string }; archivedAt: string | null; activity: { kind: string; actor: string | null; nextValue: { days?: number } }[] };
    const readAs = async (cookie: string, identifier: string) => (await (await f.any(cookie, "/issues/" + identifier)).json()) as Read;
    const read = (identifier: string) => readAs(f.cookie, identifier);
    const closed = await read(stale.identifier), archived = await read(done.identifier);
    expect(closed.status.id).toBe(status("canceled"));
    expect(archived.archivedAt).not.toBeNull();
    // Every reader finds the reason entry in the issue's own activity: the owner, a follower and a member who does not follow.
    for (const cookie of [f.cookie, f.bobCookie, f.caraCookie]) {
      expect((await readAs(cookie, stale.identifier)).activity.filter((a) => a.kind === "issue.auto_closed"))
        .toEqual([expect.objectContaining({ actor: "Auto-close automation", nextValue: expect.objectContaining({ days: 30 }) })]);
      expect((await readAs(cookie, done.identifier)).activity.filter((a) => a.kind === "issue.auto_archived"))
        .toEqual([expect.objectContaining({ actor: "Auto-archive automation", nextValue: expect.objectContaining({ days: 90 }) })]);
    }
    for (const kept of [staleBug, fresh]) expect((await read(kept.identifier)).status.id).toBe(status("backlog"));

    // Each follower gets exactly one notification per automated change, as the manual cancel gave; non-followers get none.
    const inbox = async (cookie: string, identifier: string) =>
      ((await (await f.any(cookie, "/notifications?limit=50")).json()) as InboxPage).items.filter((i) => i.identifier === identifier);
    const byHand = await inbox(f.bobCookie, manual.identifier);
    expect(byHand.map((i) => i.causes)).toEqual([["canceled"]]);
    // Bob follows explicitly and the owner as the issues' creator.
    for (const cookie of [f.bobCookie, f.cookie]) {
      expect((await inbox(cookie, stale.identifier)).map((i) => [i.actor, i.causes])).toEqual([["Auto-close automation", byHand[0].causes]]);
      expect((await inbox(cookie, done.identifier)).map((i) => [i.actor, i.causes])).toEqual([["Auto-archive automation", ["archived"]]]);
    }
    for (const issue of [stale, done]) expect(await inbox(f.caraCookie, issue.identifier)).toEqual([]);
    // Mail follows the same rule as the manual status change (status changes send no email).
    const mailed = (issue: { id: string }) =>
      count("notification_deliveries d JOIN notifications n ON n.id=d.notification_id", "n.issue_id=?", [issue.id]);
    for (const issue of [stale, done]) expect(await mailed(issue)).toBe(await mailed(manual));

    // Non-readers see neither the issue nor its entry: a signed-out visitor and a removed member.
    expect((await f.call(`/settings/operators/${f.cara}`, "DELETE")).status).toBe(200);
    for (const cookie of ["", f.caraCookie])
      for (const issue of [stale, done]) {
        const refused = await request("/api/issues/" + issue.identifier, "GET", undefined, cookie);
        expect(refused.status).toBe(401);
        expect(await refused.text()).not.toContain("Auto-");
      }

    // Archived issues leave lists and default search, stay findable and exported.
    const listed = async (query: string) =>
      ((await (await f.call("/issues?" + query)).json()) as { issues: { identifier: string }[] }).issues.map((i) => i.identifier);
    expect(await listed("category=completed")).not.toContain(done.identifier);
    expect(await listed("")).toContain(stale.identifier);
    const search = async (all: boolean) =>
      ((await (await f.call(`/search?q=${encodeURIComponent("Shipped invoice export")}&includeArchived=${all}`)).json()) as { issues: { identifier: string }[] }).issues.map((i) => i.identifier);
    expect(await search(false)).not.toContain(done.identifier);
    expect(await search(true)).toContain(done.identifier);
    const job = (await (await f.call("/portability/exports", "POST", {})).json() as { id: string }).id;
    let phase = "building";
    while (phase === "building") phase = ((await (await f.call(`/portability/exports/${job}/advance`, "POST", { maxParts: 16 })).json()) as { phase: string }).phase;
    const rows: string[] = [];
    for await (const row of readArchive((await f.call(`/portability/exports/${job}/download`)).body!)) rows.push(JSON.stringify(row));
    expect(rows.some((row) => row.includes(done.id) && row.includes(archived.archivedAt!))).toBe(true);

    // Choosing another status brings an archived issue back.
    const reopened = await f.call("/issues/" + done.identifier, "PATCH", { expectedVersion: (await (await f.call("/issues/" + done.identifier)).json() as { version: number }).version, statusId: status("started") });
    expect(reopened.status, await reopened.clone().text()).toBe(200);
    expect((await read(done.identifier)).archivedAt).toBeNull();
    expect(await listed("")).toContain(done.identifier);
  },
);
